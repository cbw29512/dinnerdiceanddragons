"""Integration tests for account, role, and catalog eligibility in Table Match loading."""

from datetime import date

import pytest
from sqlalchemy import select
from table_match_runner_test_support import build_runner_factory

from app.models.game_system import GameSystem
from app.models.user import AccountStatus, User
from app.models.user_role import UserRole, UserRoleType
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
        gm_user = session.scalar(select(User).where(User.auth_provider_user_id == "runner-gm"))
        assert gm_user is not None
        gm_user.status = account_status
        session.commit()

    _assert_no_match(factory)


def test_non_active_player_cannot_satisfy_minimum_player_threshold() -> None:
    factory = build_runner_factory(player_count=3, gm_minimum_players=3)
    with factory() as session:
        player = _first_player(session)
        player.status = AccountStatus.SUSPENDED.value
        session.commit()

    _assert_no_match(factory)


def test_removed_gm_role_excludes_old_gm_signal() -> None:
    factory = build_runner_factory()
    with factory() as session:
        gm_user = session.scalar(select(User).where(User.auth_provider_user_id == "runner-gm"))
        assert gm_user is not None
        role = session.scalar(
            select(UserRole).where(
                UserRole.user_id == gm_user.id,
                UserRole.role == UserRoleType.GM.value,
            )
        )
        assert role is not None
        session.delete(role)
        session.commit()

    _assert_no_match(factory)


def test_removed_player_role_cannot_satisfy_minimum_player_threshold() -> None:
    factory = build_runner_factory(player_count=3, gm_minimum_players=3)
    with factory() as session:
        player = _first_player(session)
        role = session.scalar(
            select(UserRole).where(
                UserRole.user_id == player.id,
                UserRole.role == UserRoleType.PLAYER.value,
            )
        )
        assert role is not None
        session.delete(role)
        session.commit()

    _assert_no_match(factory)


def test_inactive_game_system_is_excluded_from_matching() -> None:
    factory = build_runner_factory()
    with factory() as session:
        system = session.scalar(select(GameSystem))
        assert system is not None
        system.active = False
        session.commit()

    _assert_no_match(factory)


def _first_player(session):
    player = session.scalar(
        select(User)
        .where(User.auth_provider_user_id.like("runner-player-%"))
        .order_by(User.auth_provider_user_id)
    )
    assert player is not None
    return player


def _assert_no_match(factory) -> None:
    result = run_table_match(
        window_start=MATCH_DATE,
        window_end=MATCH_DATE,
        session_factory=factory,
        postal_resolver=StaticPostalResolver(),
    )
    assert result.computed_opportunities == 0
    assert result.persisted == ()
