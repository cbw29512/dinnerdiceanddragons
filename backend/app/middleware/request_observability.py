"""Pure-ASGI request correlation and privacy-safe structured request logging."""

from __future__ import annotations

import json
import logging
from time import perf_counter
from uuid import uuid4

from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core.request_context import reset_request_id, set_request_id

LOGGER = logging.getLogger("app.http")
REQUEST_ID_HEADER = b"x-request-id"


class RequestObservabilityMiddleware:
    """Correlate every HTTP request and emit bounded structured operational logs."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request_id = str(uuid4())
        token = set_request_id(request_id)
        started = perf_counter()
        status_code = 500
        response_started = False

        async def observed_send(message: Message) -> None:
            nonlocal response_started, status_code
            if message["type"] == "http.response.start":
                response_started = True
                status_code = int(message["status"])
                headers = list(message.get("headers", []))
                headers = [(name, value) for name, value in headers if name.lower() != REQUEST_ID_HEADER]
                headers.append((REQUEST_ID_HEADER, request_id.encode("ascii")))
                message = {**message, "headers": headers}
            await send(message)

        try:
            await self.app(scope, receive, observed_send)
        except Exception as exc:
            LOGGER.exception(
                _event_json(
                    event="http_request_unhandled_exception",
                    request_id=request_id,
                    method=scope["method"],
                    path=scope["path"],
                    status_code=500,
                    duration_ms=_duration_ms(started),
                    error_type=type(exc).__name__,
                )
            )
            if response_started:
                raise
            status_code = 500
            await _send_internal_error(observed_send)
        finally:
            LOGGER.info(
                _event_json(
                    event="http_request_complete",
                    request_id=request_id,
                    method=scope["method"],
                    path=scope["path"],
                    status_code=status_code,
                    duration_ms=_duration_ms(started),
                )
            )
            reset_request_id(token)


def _event_json(
    *,
    event: str,
    request_id: str,
    method: str,
    path: str,
    status_code: int,
    duration_ms: float,
    error_type: str | None = None,
) -> str:
    payload: dict[str, str | int | float] = {
        "event": event,
        "request_id": request_id,
        "method": method,
        "path": path,
        "status_code": status_code,
        "duration_ms": duration_ms,
    }
    if error_type:
        payload["error_type"] = error_type
    return json.dumps(payload, separators=(",", ":"), sort_keys=True)


def _duration_ms(started: float) -> float:
    return round(max(0.0, (perf_counter() - started) * 1000), 3)


async def _send_internal_error(send: Send) -> None:
    body = b'{"detail":"Internal server error."}'
    await send(
        {
            "type": "http.response.start",
            "status": 500,
            "headers": [
                (b"content-type", b"application/json"),
                (b"content-length", str(len(body)).encode("ascii")),
            ],
        }
    )
    await send({"type": "http.response.body", "body": body})


__all__ = ["REQUEST_ID_HEADER", "RequestObservabilityMiddleware"]
