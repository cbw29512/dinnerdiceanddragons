"""Rate-limit policies and privacy-preserving request subject helpers."""

import hashlib
import hmac
import ipaddress
import logging
from dataclasses import dataclass

from fastapi import Request

from app.core.config import Settings

LOGGER = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class RateLimitPolicy:
    """One endpoint class with separate shared-IP and authenticated-user limits."""

    name: str
    ip_limit: int
    user_limit: int
    window_seconds: int

    def limit_for(self, subject_kind: str) -> int:
        """Return the configured allowance for one trusted subject type."""

        try:
            if subject_kind == "ip":
                return self.ip_limit
            if subject_kind == "user":
                return self.user_limit
            raise ValueError(f"Unsupported rate-limit subject kind: {subject_kind}")
        except Exception:
            LOGGER.exception("Failed to resolve rate-limit subject allowance")
            raise


@dataclass(frozen=True, slots=True)
class RateLimitDecision:
    """Result returned after atomically consuming one request allowance."""

    allowed: bool
    limit: int
    remaining: int
    retry_after_seconds: int


READ_POLICY = RateLimitPolicy("read", ip_limit=600, user_limit=240, window_seconds=60)
MUTATION_POLICY = RateLimitPolicy("mutation", ip_limit=180, user_limit=60, window_seconds=60)
MESSAGE_POLICY = RateLimitPolicy("message", ip_limit=120, user_limit=30, window_seconds=60)
EXPENSIVE_POLICY = RateLimitPolicy("expensive", ip_limit=12, user_limit=6, window_seconds=300)


def policy_for_request(method: str, path: str) -> RateLimitPolicy | None:
    """Map one request to a bounded endpoint class without route-local duplication."""

    try:
        normalized_method = method.upper()
        if normalized_method == "OPTIONS" or path == "/api/v1/health":
            return None
        if path == "/api/v1/matching/run":
            return EXPENSIVE_POLICY
        if path.endswith("/messages") and normalized_method == "POST":
            return MESSAGE_POLICY
        if normalized_method in {"POST", "PUT", "PATCH", "DELETE"}:
            return MUTATION_POLICY
        if path.startswith("/api/v1/"):
            return READ_POLICY
        return None
    except Exception:
        LOGGER.exception("Failed to classify request for rate limiting")
        raise


def resolve_client_ip(request: Request, settings: Settings) -> str:
    """Resolve a client address without logging or persisting the raw value."""

    try:
        candidates: list[str] = []
        if settings.app_env in {"staging", "production"}:
            forwarded = request.headers.get("x-vercel-forwarded-for", "")
            if forwarded:
                candidates.append(forwarded.split(",", maxsplit=1)[0].strip())
        if request.client and request.client.host:
            candidates.append(request.client.host)

        for candidate in candidates:
            try:
                return str(ipaddress.ip_address(candidate))
            except ValueError:
                continue
        return "unknown"
    except Exception:
        LOGGER.exception("Failed to resolve request client address")
        raise


def hash_rate_limit_subject(secret: bytes, subject_kind: str, subject: str) -> str:
    """HMAC one subject so limiter state never stores raw IP or user IDs."""

    try:
        material = f"{subject_kind}:{subject}".encode("utf-8")
        return hmac.new(secret, material, hashlib.sha256).hexdigest()
    except Exception:
        LOGGER.exception("Failed to hash rate-limit subject")
        raise
