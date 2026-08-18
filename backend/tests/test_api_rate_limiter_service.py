"""Deterministic token-bucket service tests for distributed API abuse controls."""

from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import pytest
from sqlalchemy import create_engine, event, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.models.api_rate_limit_bucket import ApiRateLimitBucket
from app.models.user import AccountStatus, User
from app.services.api_rate_limit_policy import RateLimitPolicy, RateLimitScope
from app.services.api_rate_limiter import RateLimitExceededError, consume_user_token


def _sqlite_factory() -> tuple[sessionmaker[Session], object, UUID]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(engine, "connect")
    def enable_foreign_keys(dbapi_connection: object, _: object) -> None:
        cursor = dbapi_connection.cursor()  # type: ignore[attr-defined]
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    User.__table__.create(engine)
    ApiRateLimitBucket.__table__.create(engine)
    factory = sessionmaker(
        bind=engine,
        class_=Session,
        autoflush=False,
        expire_on_commit=False,
    )
    user_id = uuid4()
    with factory() as session:
        session.add(
            User(
                id=user_id,
                auth_provider_user_id=f"rate-limit-{user_id}",
                email=f"rate-limit-{user_id}@example.com",
                status=AccountStatus.ACTIVE.value,
            )
        )
        session.commit()
    return factory, engine, user_id


def test_token_bucket_exhaustion_and_refill_are_deterministic() -> None:
    factory, engine, user_id = _sqlite_factory()
    policy = RateLimitPolicy(
        scope=RateLimitScope.HUB_MESSAGE,
        capacity=2,
        refill_tokens=1,
        refill_seconds=10,
    )
    start = datetime(2030, 1, 1, tzinfo=UTC)
    try:
        with factory() as session:
            assert consume_user_token(session, user_id, policy, now=start) == 1
            assert consume_user_token(session, user_id, policy, now=start) == 0
            with pytest.raises(RateLimitExceededError) as blocked:
                consume_user_token(session, user_id, policy, now=start)
            assert blocked.value.retry_after_seconds == 10

            with pytest.raises(RateLimitExceededError) as halfway:
                consume_user_token(
                    session,
                    user_id,
                    policy,
                    now=start + timedelta(seconds=5),
                )
            assert halfway.value.retry_after_seconds == 5

            assert (
                consume_user_token(
                    session,
                    user_id,
                    policy,
                    now=start + timedelta(seconds=10),
                )
                == 0
            )
            buckets = session.scalars(select(ApiRateLimitBucket)).all()
            assert len(buckets) == 1
            assert buckets[0].tokens == pytest.approx(0.0)
    finally:
        engine.dispose()
