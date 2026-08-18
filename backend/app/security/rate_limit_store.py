"""Atomic PostgreSQL storage operations for distributed API rate limiting."""

import logging

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.security.rate_limit_policy import RateLimitDecision, RateLimitPolicy

LOGGER = logging.getLogger(__name__)

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
        LOGGER.exception(
            "Distributed rate-limit state update failed",
            extra={"policy": policy.name},
        )
        raise
