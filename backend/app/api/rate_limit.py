"""HTTP adapter for distributed authenticated API rate limiting."""

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.user import User
from app.services.api_rate_limit_policy import RateLimitScope, policy_for
from app.services.api_rate_limiter import (
    RateLimitExceededError,
    RateLimitPersistenceError,
    consume_user_token,
)


def enforce_user_rate_limit(
    session: Session,
    user: User,
    scope: RateLimitScope,
) -> int:
    """Consume one scoped token or raise the controlled API error contract."""

    try:
        return consume_user_token(session, user.id, policy_for(scope))
    except RateLimitExceededError as exc:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests. Try again shortly.",
            headers={"Retry-After": str(exc.retry_after_seconds)},
        ) from exc
    except RateLimitPersistenceError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Request could not be safely rate-limited. Try again shortly.",
            headers={"Retry-After": "5"},
        ) from exc


__all__ = ["enforce_user_rate_limit"]
