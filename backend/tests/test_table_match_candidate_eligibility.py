"""Integration tests for account and catalog eligibility in Table Match loading."""

from datetime import date

import pytest
from sqlalchemy import select
from table_match_runner_test_support import build_runner_factory

from app.models.game_system import GameSystem
from app.models.user import AccountStatus, User
from app.services.postal_centroids import PostalCentroidResult
from app.services.table_match_runner import run_table_match

MATCH_DATE = date(2026, 8, 21)


class StaticPostalResolver:
    """Return a deterministic local centroid without network access."""

    def resolve(self, postal_code: str) -> PostalCentroidResult:
        return PostalCentroidResult(
            postal_code=postal_code,
            latitude=34.1954,
            longitude=-79.7626,
            accuracy=1.0,
            accuracy_type="place",
            provider="test",
        )


@pytest.mark.parametrize(
    "account_status",
    [
        AccountStatus.PENDING_VERIFICATION.value,
        AccountStatus.RESTRICTED.value,
        AccountStatus.SUSPENDED.value,
        AccountStatus.BANNED.value,
    ],
)
def test_non_active_gm_account_is_excluded(account_status: str) -> None:
    factory = build_runner_factory()
    with factory() as session:
        gm_user = session.scalar(
            select(User).where(User.auth_provider_user_id == "runner-gm")
        )
        assert gm_user is not None
        gm_user.status = account_status
        session.commit()

    result = _run(factory)

    assert result.computed_opportunities == 0
    assert result.persisted == ()


def test_non_active_player_cannot_satisfy_minimum_player_threshold() -> None:
    factory = build_runner_factory(player_count=3, gm_minimum_players=3)
    with factory() as session:
        player = session.scalar(
            select(User)
            .where(User.auth_provider_user_id.like("runner-player-%"))
            .order_by(User.auth_provider_user_id)
        )
        assert player is not None
        player.status = AccountStatus.SUSPENDED.value
        session.commit()

    result = _run(factory)

    assert result.computed_opportunities == 0
    assert result.persisted == ()


def test_inactive_game_system_is_excluded_from_matching() -> None:
    factory = build_runner_factory()
    with factory() as session:
        system = session.scalar(select(GameSystem))
        assert system is not None
        system.active = False
        session.commit()

    result = _run(factory)

    assert result.computed_opportunities == 0
    assert result.persisted == ()


def _run(factory):
    return run_table_match(
        window_start=MATCH_DATE,
        window_end=MATCH_DATE,
        session_factory=factory,
        postal_resolver=StaticPostalResolver(),
    )
