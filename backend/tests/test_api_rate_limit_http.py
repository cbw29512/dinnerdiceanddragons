"""HTTP error contracts for distributed API abuse controls."""

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from fastapi import HTTPException
from game_hub_live_test_support import auth, build_hub_client
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.rate_limit import enforce_user_rate_limit
from app.api.routes.game_hub import router as game_hub_router
from app.models.api_rate_limit_bucket import ApiRateLimitBucket
from app.models.message import Message
from app.models.user import AccountStatus, User
from app.services.api_rate_limit_policy import RateLimitScope
from app.services.api_rate_limiter import RateLimitPersistenceError


def test_exhausted_message_bucket_returns_429_and_does_not_persist() -> None:
    client, factory, engine, seed = build_hub_client((game_hub_router,))
    try:
        with factory() as session:
            alice = session.scalar(select(User).where(User.email == "alice@example.com"))
            assert alice is not None
            session.add(
                ApiRateLimitBucket(
                    user_id=alice.id,
                    scope=RateLimitScope.HUB_MESSAGE.value,
                    tokens=0.0,
                    last_refill_at=datetime.now(UTC) + timedelta(minutes=5),
                )
            )
            session.commit()

        response = client.post(
            f"/api/v1/events/{seed.event_id}/messages",
            headers=auth("alice-token"),
            json={"channel_type": "table_discussion", "body": "Do not persist me."},
        )
        assert response.status_code == 429, response.text
        assert int(response.headers["retry-after"]) >= 1
        assert response.json() == {"detail": "Too many requests. Try again shortly."}

        with factory() as session:
            assert (
                session.scalar(select(Message).where(Message.body == "Do not persist me."))
                is None
            )
    finally:
        client.close()
        engine.dispose()


def test_limiter_persistence_failure_is_fail_closed(monkeypatch: pytest.MonkeyPatch) -> None:
    user = User(
        id=uuid4(),
        auth_provider_user_id="rate-limit-failure-user",
        email="rate-limit-failure@example.com",
        status=AccountStatus.ACTIVE.value,
    )

    def fail_persistence(*_args, **_kwargs):
        raise RateLimitPersistenceError("simulated distributed-store failure")

    monkeypatch.setattr("app.api.rate_limit.consume_user_token", fail_persistence)

    with pytest.raises(HTTPException) as blocked:
        enforce_user_rate_limit(Session(), user, RateLimitScope.HUB_MESSAGE)

    assert blocked.value.status_code == 503
    assert blocked.value.headers == {"Retry-After": "5"}
    assert blocked.value.detail == "Request could not be safely rate-limited. Try again shortly."
