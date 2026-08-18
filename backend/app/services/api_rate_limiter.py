"""Distributed PostgreSQL token-bucket enforcement for authenticated API writes."""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from math import ceil, floor
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.models.api_rate_limit_bucket import ApiRateLimitBucket
from app.services.api_rate_limit_policy import RateLimitPolicy

LOGGER = logging.getLogger(__name__)


class RateLimitExceededError(RuntimeError):
    def __init__(self, retry_after_seconds: int, remaining: int = 0) -> None:
        super().__init__("Rate limit exceeded.")
        self.retry_after_seconds = max(1, retry_after_seconds)
        self.remaining = max(0, remaining)


class RateLimitPersistenceError(RuntimeError):
    pass


def consume_user_token(
    session: Session,
    user_id: UUID,
    policy: RateLimitPolicy,
    *,
    now: datetime | None = None,
) -> int:
    """Consume one token transactionally and return whole tokens remaining."""

    moment = now or datetime.now(UTC)
    try:
        bucket = _locked_bucket(session, user_id, policy.scope.value)
        if bucket is None:
            bucket = _create_initial_bucket(session, user_id, policy, moment)
            if bucket is not None:
                session.commit()
                return max(0, policy.capacity - 1)
            bucket = _locked_bucket(session, user_id, policy.scope.value)
            if bucket is None:
                raise RateLimitPersistenceError("Rate-limit bucket could not be loaded.")

        elapsed = max(0.0, (moment - bucket.last_refill_at).total_seconds())
        available = min(
            float(policy.capacity),
            float(bucket.tokens) + elapsed * policy.refill_rate_per_second,
        )
        bucket.last_refill_at = moment

        if available < 1.0:
            bucket.tokens = max(0.0, available)
            session.commit()
            retry_after = ceil((1.0 - available) / policy.refill_rate_per_second)
            raise RateLimitExceededError(retry_after_seconds=retry_after)

        bucket.tokens = available - 1.0
        remaining = floor(bucket.tokens)
        session.commit()
        return max(0, remaining)
    except RateLimitExceededError:
        raise
    except RateLimitPersistenceError:
        _rollback_safely(session)
        raise
    except SQLAlchemyError as exc:
        _rollback_safely(session)
        LOGGER.exception(
            "Distributed API rate-limit persistence failed for scope=%s user_id=%s",
            policy.scope.value,
            user_id,
        )
        raise RateLimitPersistenceError("Rate-limit state could not be persisted.") from exc


def _locked_bucket(session: Session, user_id: UUID, scope: str) -> ApiRateLimitBucket | None:
    return session.scalar(
        select(ApiRateLimitBucket)
        .where(
            ApiRateLimitBucket.user_id == user_id,
            ApiRateLimitBucket.scope == scope,
        )
        .with_for_update()
    )


def _create_initial_bucket(
    session: Session,
    user_id: UUID,
    policy: RateLimitPolicy,
    moment: datetime,
) -> ApiRateLimitBucket | None:
    bucket = ApiRateLimitBucket(
        user_id=user_id,
        scope=policy.scope.value,
        tokens=float(max(0, policy.capacity - 1)),
        last_refill_at=moment,
    )
    try:
        with session.begin_nested():
            session.add(bucket)
            session.flush()
        return bucket
    except IntegrityError:
        # Another worker may have created the same user/scope bucket first.
        return None


def _rollback_safely(session: Session) -> None:
    try:
        session.rollback()
    except Exception:
        LOGGER.exception("Rollback failed after API rate-limit persistence error")


__all__ = [
    "RateLimitExceededError",
    "RateLimitPersistenceError",
    "consume_user_token",
]
