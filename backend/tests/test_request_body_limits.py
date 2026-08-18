"""Unit contracts for hard API request-body limits."""

import asyncio

from fastapi import FastAPI, Request
from fastapi.testclient import TestClient
from starlette.responses import JSONResponse

from app.api.request_limits import RequestBodyLimitMiddleware


def _app(max_body_bytes: int) -> FastAPI:
    application = FastAPI()
    application.add_middleware(RequestBodyLimitMiddleware, max_body_bytes=max_body_bytes)

    @application.post("/echo")
    async def echo(request: Request) -> dict[str, int]:
        body = await request.body()
        return {"size": len(body)}

    return application


def test_declared_oversized_body_is_rejected_before_route_parsing() -> None:
    response = TestClient(_app(8)).post("/echo", content=b"123456789")

    assert response.status_code == 413
    assert response.json() == {"detail": "Request body is too large."}


def test_body_at_limit_is_replayed_to_fastapi() -> None:
    response = TestClient(_app(8)).post("/echo", content=b"12345678")

    assert response.status_code == 200
    assert response.json() == {"size": 8}


def test_streamed_body_without_content_length_is_still_bounded() -> None:
    route_called = False
    sent: list[dict[str, object]] = []
    messages = iter(
        [
            {"type": "http.request", "body": b"1234", "more_body": True},
            {"type": "http.request", "body": b"5678", "more_body": False},
        ]
    )

    async def downstream(scope, receive, send) -> None:
        nonlocal route_called
        route_called = True
        response = JSONResponse({"ok": True})
        await response(scope, receive, send)

    async def receive() -> dict[str, object]:
        return next(messages)

    async def send(message: dict[str, object]) -> None:
        sent.append(message)

    scope = {
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": "POST",
        "scheme": "https",
        "path": "/echo",
        "raw_path": b"/echo",
        "query_string": b"",
        "headers": [],
        "client": ("127.0.0.1", 12345),
        "server": ("testserver", 443),
    }

    asyncio.run(RequestBodyLimitMiddleware(downstream, max_body_bytes=6)(scope, receive, send))

    assert route_called is False
    assert sent[0]["type"] == "http.response.start"
    assert sent[0]["status"] == 413
