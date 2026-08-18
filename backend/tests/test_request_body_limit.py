"""Contracts for the production mutation request-body size guard."""

import asyncio
from collections.abc import Awaitable, Callable
from typing import Any

from fastapi.testclient import TestClient

from app.main import create_app
from app.middleware.request_size import DEFAULT_MAX_BODY_BYTES, RequestBodyLimitMiddleware


def test_oversized_mutation_is_rejected_before_auth_or_validation() -> None:
    with TestClient(create_app()) as client:
        response = client.post(
            "/api/v1/onboarding/player",
            content=b"x" * (DEFAULT_MAX_BODY_BYTES + 1),
            headers={"Content-Type": "application/json"},
        )

    assert response.status_code == 413
    assert response.json() == {
        "detail": "Request body is too large.",
        "max_body_bytes": DEFAULT_MAX_BODY_BYTES,
    }


def test_small_mutation_reaches_normal_application_boundary() -> None:
    with TestClient(create_app()) as client:
        response = client.post(
            "/api/v1/onboarding/player",
            content=b"{}",
            headers={"Content-Type": "application/json"},
        )

    assert response.status_code == 401


def test_streamed_body_without_content_length_cannot_bypass_limit() -> None:
    downstream_called = False
    sent: list[dict[str, Any]] = []
    chunks = iter(
        [
            {"type": "http.request", "body": b"a" * 40_000, "more_body": True},
            {"type": "http.request", "body": b"b" * 30_000, "more_body": False},
        ]
    )

    async def downstream(_scope, _receive, _send) -> None:
        nonlocal downstream_called
        downstream_called = True

    async def receive() -> dict[str, Any]:
        return next(chunks)

    async def send(message: dict[str, Any]) -> None:
        sent.append(message)

    middleware = RequestBodyLimitMiddleware(downstream)
    scope = {
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": "POST",
        "scheme": "https",
        "path": "/api/v1/onboarding/player",
        "raw_path": b"/api/v1/onboarding/player",
        "query_string": b"",
        "headers": [],
        "client": ("127.0.0.1", 1234),
        "server": ("testserver", 443),
    }

    asyncio.run(middleware(scope, receive, send))  # type: ignore[arg-type]

    assert downstream_called is False
    assert sent[0]["type"] == "http.response.start"
    assert sent[0]["status"] == 413
