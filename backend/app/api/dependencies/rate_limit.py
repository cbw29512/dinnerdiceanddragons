"""Authenticated-user rate-limit dependency helpers."""

import logging

from fastapi import HTTPException, Request, status

from app.core.config import get_settings
from app.models.user import User
from app.security.rate_limit_enforcement import enforce_subject_rate_limit
from app.security.rate_limit_policy import policy_for_request

LOGGER = logging.getLogger(__name__)


def enforce_authenticated_request_rate_limit(request: Request, user: User) -> None:
    """Apply the authenticated-user bucket after server-side identity verification."""

    settings = get_settings()
    if not settings.rate_limits_enabled():
        return

    try:
        policy = policy_for_request(request.method, request.url.path)
        if policy is None:
            return
        decision = enforce_subject_rate_limit(
            settings,
            policy=policy,
            subject_kind="user",
            subject=str(user.id),
        )
    except Exception as exc:
        LOGGER.exception("Authenticated-user rate-limit enforcement failed")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Request protection service is temporarily unavailable.",
            headers={"Retry-After": "5"},
        ) from exc

    if not decision.allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests. Try again shortly.",
            headers={
                "Retry-After": str(decision.retry_after_seconds),
                "X-RateLimit-Limit": str(decision.limit),
                "X-RateLimit-Remaining": "0",
            },
        )
