"""IP-based distributed rate limiting for production API traffic."""

import logging

from fastapi import Request, Response, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from app.core.config import Settings
from app.security.rate_limit_enforcement import enforce_subject_rate_limit
from app.security.rate_limit_policy import policy_for_request, resolve_client_ip

LOGGER = logging.getLogger(__name__)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Enforce shared IP buckets before protected route work begins."""

    def __init__(self, app: ASGIApp, *, settings: Settings) -> None:
        try:
            super().__init__(app)
            self._settings = settings
        except Exception:
            LOGGER.exception("Failed to construct rate-limit middleware")
            raise

    async def dispatch(self, request: Request, call_next) -> Response:
        """Apply the endpoint-class IP policy and return stable overload responses."""

        try:
            policy = policy_for_request(request.method, request.url.path)
            if policy is None or not self._settings.rate_limits_enabled():
                return await call_next(request)

            client_ip = resolve_client_ip(request, self._settings)
            decision = enforce_subject_rate_limit(
                self._settings,
                policy=policy,
                subject_kind="ip",
                subject=client_ip,
            )
            if not decision.allowed:
                return JSONResponse(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    content={"detail": "Too many requests. Try again shortly."},
                    headers={
                        "Retry-After": str(decision.retry_after_seconds),
                        "X-RateLimit-Limit": str(decision.limit),
                        "X-RateLimit-Remaining": "0",
                    },
                )

            response = await call_next(request)
            response.headers["X-RateLimit-Limit"] = str(decision.limit)
            response.headers["X-RateLimit-Remaining"] = str(decision.remaining)
            return response
        except Exception:
            LOGGER.exception("IP rate-limit middleware failed")
            return JSONResponse(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                content={"detail": "Request protection service is temporarily unavailable."},
                headers={"Retry-After": "5"},
            )
