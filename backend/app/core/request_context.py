"""Per-request correlation context for safe operational logging."""

from contextvars import ContextVar, Token

REQUEST_ID: ContextVar[str | None] = ContextVar("ddd_request_id", default=None)


def set_request_id(request_id: str) -> Token[str | None]:
    """Set the current server-generated request identifier."""

    return REQUEST_ID.set(request_id)


def get_request_id() -> str | None:
    """Return the active request identifier for application log enrichment."""

    return REQUEST_ID.get()


def reset_request_id(token: Token[str | None]) -> None:
    """Restore the previous request context after the HTTP scope completes."""

    REQUEST_ID.reset(token)


__all__ = ["get_request_id", "reset_request_id", "set_request_id"]
