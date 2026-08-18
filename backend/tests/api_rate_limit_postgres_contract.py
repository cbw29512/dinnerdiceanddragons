"""Executable PostgreSQL concurrency contract for distributed API rate limiting."""

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from threading import Barrier, Lock, Thread
from uuid import UUID, uuid4

from sqlalchemy import select

from app.db.session import get_session_factory
from app.models.api_rate_limit_bucket import ApiRateLimitBucket
from app.models.user import AccountStatus, User
from app.services.api_rate_limit_policy import RateLimitPolicy, RateLimitScope
from app.services.api_rate_limiter import RateLimitExceededError, consume_user_token


@dataclass(frozen=True, slots=True)
class ContractSeed:
    user_id: UUID


def main() -> None:
    factory = get_session_factory()
    seed = _seed(factory)
    _verify_first_request_race(factory, seed)
    _verify_existing_bucket_serialization(factory, seed)
    print("Distributed API rate-limit PostgreSQL concurrency contract passed.")


def _seed(factory) -> ContractSeed:
    user_id = uuid4()
    with factory() as session:
        session.add(
            User(
                id=user_id,
                auth_provider_user_id=f"rate-limit-contract-{user_id}",
                email=f"rate-limit-contract-{user_id}@example.com",
                status=AccountStatus.ACTIVE.value,
            )
        )
        session.commit()
    return ContractSeed(user_id=user_id)


def _verify_first_request_race(factory, seed: ContractSeed) -> None:
    policy = RateLimitPolicy(
        scope=RateLimitScope.HUB_MESSAGE,
        capacity=1,
        refill_tokens=1,
        refill_seconds=3600,
    )
    moment = datetime.now(UTC)
    outcomes = _race_consumers(factory, seed.user_id, policy, moment)
    assert sorted(outcomes) == ["allowed", "blocked"], outcomes

    with factory() as session:
        bucket = session.scalar(
            select(ApiRateLimitBucket).where(
                ApiRateLimitBucket.user_id == seed.user_id,
                ApiRateLimitBucket.scope == policy.scope.value,
            )
        )
        assert bucket is not None
        assert bucket.tokens == 0.0


def _verify_existing_bucket_serialization(factory, seed: ContractSeed) -> None:
    policy = RateLimitPolicy(
        scope=RateLimitScope.EVENT_REGISTRATION,
        capacity=1,
        refill_tokens=1,
        refill_seconds=3600,
    )
    moment = datetime.now(UTC)
    with factory() as session:
        session.add(
            ApiRateLimitBucket(
                user_id=seed.user_id,
                scope=policy.scope.value,
                tokens=1.0,
                last_refill_at=moment + timedelta(minutes=5),
            )
        )
        session.commit()

    outcomes = _race_consumers(factory, seed.user_id, policy, moment)
    assert sorted(outcomes) == ["allowed", "blocked"], outcomes

    with factory() as session:
        bucket = session.scalar(
            select(ApiRateLimitBucket).where(
                ApiRateLimitBucket.user_id == seed.user_id,
                ApiRateLimitBucket.scope == policy.scope.value,
            )
        )
        assert bucket is not None
        assert bucket.tokens == 0.0


def _race_consumers(factory, user_id: UUID, policy: RateLimitPolicy, moment: datetime) -> list[str]:
    barrier = Barrier(2)
    lock = Lock()
    outcomes: list[str] = []
    errors: list[BaseException] = []

    def worker() -> None:
        try:
            with factory() as session:
                barrier.wait()
                try:
                    consume_user_token(session, user_id, policy, now=moment)
                    outcome = "allowed"
                except RateLimitExceededError:
                    outcome = "blocked"
                with lock:
                    outcomes.append(outcome)
        except BaseException as exc:
            with lock:
                errors.append(exc)

    threads = [Thread(target=worker) for _ in range(2)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=15)
        assert not thread.is_alive(), "Rate-limit concurrency worker did not finish."

    if errors:
        raise AssertionError(f"Rate-limit concurrency errors: {errors!r}")
    return outcomes


if __name__ == "__main__":
    main()
