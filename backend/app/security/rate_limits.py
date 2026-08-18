"""Distributed fixed-window API rate limiting backed by PostgreSQL."""

import hashlib
import hmac
import ipaddress
import logging
from dataclasses import dataclass

from fastapi import Request
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import Settings

LOGGER = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class RateLimitPolicy:
    """One endpoint-class limit shared by IP and authenticated-user subjects."""

    name: str
    limit: int
    window_seconds: int


@dataclass(frozen=True, slots=True)
class RateLimitDecision:
    """Result returned after atomically consuming one request allowance."""

    allowed: bool
    limit: int
    remaining: int
    retry_after_seconds: int


READ_POLICY = RateLimitPolicy("read", limit=240, window_seconds=60)
MUTATION_POLICY = RateLimitPolicy("mutation", limit=60, window_seconds=60)
MESSAGE_POLICY = RateLimitPolicy("message", limit=30, window_seconds=60)
EXPENSIVE_POLICY = RateLimitPolicy("expensive", limit=6, window_seconds=300)

_RATE_LIMIT_UPSERT = text(
    """
    INSERT INTO api_rate_limit_buckets AS bucket (
        policy,
        subject_hash,
        window_started_at,
        request_count,
        expires_at
    )
    VALUES (
        :policy,
        :subject_hash,
        CURRENT_TIMESTAMP,
        1,
        CURRENT_TIMESTAMP + (:window_seconds * INTERVAL '1 second')
    )
    ON CONFLICT (policy, subject_hash) DO UPDATE SET
        request_count = CASE
            WHEN bucket.expires_at <= CURRENT_TIMESTAMP THEN 1
            ELSE LEAST(bucket.request_count + 1, :counter_ceiling)
        END,
        window_started_at = CASE
            WHEN bucket.expires_at <= CURRENT_TIMESTAMP THEN CURRENT_TIMESTAMP
            ELSE bucket.window_started_at
        END,
        expires_at = CASE
            WHEN bucket.expires_at <= CURRENT_TIMESTAMP
                THEN CURRENT_TIMESTAMP + (:window_seconds * INTERVAL '1 second')
            ELSE bucket.expires_at
        END
    RETURNING
        request_count,
        GREATEST(
            1,
            CEIL(EXTRACT(EPOCH FROM (expires_at - CURRENT_TIMESTAMP)))
        )::integer AS retry_after_seconds
    """
)


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
    """Resolve a stable client address without logging or persisting the raw value."""

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
    """HMAC one subject so operational limiter state never stores raw IP/user IDs."""

    try:
        material = f"{subject_kind}:{subject}".encode("utf-8")
        return hmac.new(secret, material, hashlib.sha256).hexdigest()
    except Exception:
        LOGGER.exception("Failed to hash rate-limit subject")
        raise


def consume_rate_limit(
    session: Session,
    *,
    policy: RateLimitPolicy,
    subject_hash: str,
) -> RateLimitDecision:
    """Atomically consume one allowance from the shared PostgreSQL bucket."""

    try:
        row = session.execute(
            _RATE_LIMIT_UPSERT,
            {
                "policy": policy.name,
                "subject_hash": subject_hash,
                "window_seconds": policy.window_seconds,
                "counter_ceiling": policy.limit + 1,
            },
        ).mappings().one()
        request_count = int(row["request_count"])
        retry_after_seconds = int(row["retry_after_seconds"])
        return RateLimitDecision(
            allowed=request_count <= policy.limit,
            limit=policy.limit,
            remaining=max(0, policy.limit - request_count),
            retry_after_seconds=max(1, retry_after_seconds),
        )
    except Exception:
        LOGGER.exception("Distributed rate-limit state update failed", extra={"policy": policy.name})
        raise
