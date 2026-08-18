"""Unit tests for atomic distributed rate-limit storage decisions."""

from app.security.rate_limit_policy import MUTATION_POLICY
from app.security.rate_limit_store import consume_rate_limit


class _FakeResult:
    def __init__(self, row: dict[str, int]) -> None:
        self._row = row

    def mappings(self) -> "_FakeResult":
        return self

    def one(self) -> dict[str, int]:
        return self._row


class _FakeSession:
    def __init__(self, row: dict[str, int]) -> None:
        self._row = row
        self.params: dict[str, object] | None = None

    def execute(self, statement: object, params: dict[str, object]) -> _FakeResult:
        assert statement is not None
        self.params = params
        return _FakeResult(self._row)


def test_allowed_request_returns_remaining_allowance_and_bounded_counter() -> None:
    session = _FakeSession({"request_count": 2, "retry_after_seconds": 41})

    decision = consume_rate_limit(
        session,  # type: ignore[arg-type]
        policy=MUTATION_POLICY,
        subject_hash="a" * 64,
        limit=60,
    )

    assert decision.allowed is True
    assert decision.limit == 60
    assert decision.remaining == 58
    assert decision.retry_after_seconds == 41
    assert session.params is not None
    assert session.params["counter_ceiling"] == 61
    assert session.params["window_seconds"] == 60


def test_over_limit_request_is_denied_without_negative_remaining() -> None:
    session = _FakeSession({"request_count": 61, "retry_after_seconds": 17})

    decision = consume_rate_limit(
        session,  # type: ignore[arg-type]
        policy=MUTATION_POLICY,
        subject_hash="b" * 64,
        limit=60,
    )

    assert decision.allowed is False
    assert decision.remaining == 0
    assert decision.retry_after_seconds == 17
