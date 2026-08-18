"""Pure-ASGI request body guard for bounded production mutation payloads."""

from __future__ import annotations

from starlette.types import ASGIApp, Message, Receive, Scope, Send

MUTATION_METHODS = {"POST", "PUT", "PATCH", "DELETE"}
DEFAULT_MAX_BODY_BYTES = 64 * 1024


class RequestBodyLimitMiddleware:
    """Reject mutation bodies above a fixed byte limit before application parsing."""

    def __init__(self, app: ASGIApp, max_body_bytes: int = DEFAULT_MAX_BODY_BYTES) -> None:
        if max_body_bytes < 1:
            raise ValueError("max_body_bytes must be positive")
        self.app = app
        self.max_body_bytes = max_body_bytes

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or scope["method"] not in MUTATION_METHODS:
            await self.app(scope, receive, send)
            return

        declared_length = _content_length(scope)
        if declared_length is not None and declared_length > self.max_body_bytes:
            await _send_too_large(send, self.max_body_bytes)
            return

        buffered: list[Message] = []
        total = 0
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            if message["type"] != "http.request":
                buffered.append(message)
                continue

            total += len(message.get("body", b""))
            if total > self.max_body_bytes:
                await _send_too_large(send, self.max_body_bytes)
                return

            buffered.append(message)
            if not message.get("more_body", False):
                break

        async def replay_receive() -> Message:
            if buffered:
                return buffered.pop(0)
            return {"type": "http.request", "body": b"", "more_body": False}

        await self.app(scope, replay_receive, send)


def _content_length(scope: Scope) -> int | None:
    for raw_name, raw_value in scope.get("headers", []):
        if raw_name.lower() != b"content-length":
            continue
        try:
            value = int(raw_value)
        except (TypeError, ValueError):
            return None
        return value if value >= 0 else None
    return None


async def _send_too_large(send: Send, max_body_bytes: int) -> None:
    body = (
        '{"detail":"Request body is too large.","max_body_bytes":'
        f"{max_body_bytes}" + "}"
    ).encode("utf-8")
    await send(
        {
            "type": "http.response.start",
            "status": 413,
            "headers": [
                (b"content-type", b"application/json"),
                (b"content-length", str(len(body)).encode("ascii")),
            ],
        }
    )
    await send({"type": "http.response.body", "body": body})


__all__ = ["DEFAULT_MAX_BODY_BYTES", "RequestBodyLimitMiddleware"]
