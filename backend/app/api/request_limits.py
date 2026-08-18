"""Hard request-body limits enforced before FastAPI parses endpoint payloads."""

import logging

from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Message, Receive, Scope, Send

LOGGER = logging.getLogger(__name__)

MAX_API_REQUEST_BODY_BYTES = 1_048_576


class RequestBodyLimitMiddleware:
    """Buffer at most one bounded request body, then replay it to FastAPI."""

    def __init__(self, app: ASGIApp, *, max_body_bytes: int = MAX_API_REQUEST_BODY_BYTES) -> None:
        try:
            if max_body_bytes < 1:
                raise ValueError("max_body_bytes must be positive")
            self._app = app
            self._max_body_bytes = max_body_bytes
        except Exception:
            LOGGER.exception("Failed to configure request-body limit middleware")
            raise

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        """Reject oversized HTTP bodies whether or not Content-Length is present."""

        if scope["type"] != "http":
            await self._app(scope, receive, send)
            return

        try:
            declared_length = self._declared_content_length(scope)
            if declared_length is not None and declared_length > self._max_body_bytes:
                await self._reject(scope, receive, send)
                return

            body = bytearray()
            while True:
                message = await receive()
                if message["type"] == "http.disconnect":
                    return
                if message["type"] != "http.request":
                    continue

                body.extend(message.get("body", b""))
                if len(body) > self._max_body_bytes:
                    await self._reject(scope, receive, send)
                    return
                if not message.get("more_body", False):
                    break

            replayed = False

            async def replay_receive() -> Message:
                nonlocal replayed
                try:
                    if not replayed:
                        replayed = True
                        return {
                            "type": "http.request",
                            "body": bytes(body),
                            "more_body": False,
                        }
                    return await receive()
                except Exception:
                    LOGGER.exception("Failed to replay bounded request body")
                    raise

            await self._app(scope, replay_receive, send)
        except ValueError:
            response = JSONResponse(
                status_code=400,
                content={"detail": "Invalid Content-Length header."},
            )
            await response(scope, receive, send)
        except Exception:
            LOGGER.exception("Request-body limit middleware failed")
            raise

    @staticmethod
    def _declared_content_length(scope: Scope) -> int | None:
        """Parse one declared body length without trusting it as the only limit."""

        try:
            for name, value in scope.get("headers", []):
                if name.lower() != b"content-length":
                    continue
                parsed = int(value.decode("ascii"))
                if parsed < 0:
                    raise ValueError("Content-Length cannot be negative")
                return parsed
            return None
        except (UnicodeDecodeError, ValueError) as exc:
            raise ValueError("Invalid Content-Length") from exc
        except Exception:
            LOGGER.exception("Failed to parse Content-Length header")
            raise

    @staticmethod
    async def _reject(scope: Scope, receive: Receive, send: Send) -> None:
        """Return one stable 413 response without reflecting request content."""

        try:
            response = JSONResponse(
                status_code=413,
                content={"detail": "Request body is too large."},
            )
            await response(scope, receive, send)
        except Exception:
            LOGGER.exception("Failed to send request-body limit response")
            raise


__all__ = ["MAX_API_REQUEST_BODY_BYTES", "RequestBodyLimitMiddleware"]
