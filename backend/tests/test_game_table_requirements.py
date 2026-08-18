"""Unit tests for the persistent GameTable formation contract."""

from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest

from app.models.game_table import GameTable, GameTableFormat, GameTableStatus
from app.services.game_table_requirement_state import (
    GameTableRequirementsError,
    GameTableTransitionError,
    evaluate_requirements_snapshot,
    transition_game_table_to_ready,
)


def make_table(*, with_gm: bool = False, with_venue: bool = False) -> GameTable:
    try:
        start = datetime(2026, 8, 22, 22, 0, tzinfo=timezone.utc)
        return GameTable(
            game_system_id=uuid4(),
            created_by_user_id=uuid4(),
            title="Florence Saturday Table",
            lifecycle_status=GameTableStatus.FORMING.value,
            game_format=GameTableFormat.ONE_SHOT.value,
            minimum_players=4,
            maximum_players=6,
            gm_profile_id=uuid4() if with_gm else None,
            venue_id=uuid4() if with_venue else None,
            proposed_start=start,
            proposed_end=start + timedelta(hours=4),
            timezone="America/New_York",
        )
    except Exception as exc:
        pytest.fail(f"GameTable test fixture construction failed: {exc}")


def test_forming_table_can_need_multiple_resources_simultaneously() -> None:
    try:
        game_table = make_table()
        game_table.proposed_start = None
        game_table.proposed_end = None
        game_table.timezone = None

        requirements = evaluate_requirements_snapshot(
            game_table,
            confirmed_players=2,
            venue_approval_required=False,
            venue_approved=False,
        )

        assert requirements.needs_gm is True
        assert requirements.minimum_players_missing == 2
        assert requirements.open_player_seats == 4
        assert requirements.needs_venue is True
        assert requirements.needs_schedule is True
        assert requirements.ready_to_confirm is False
    except Exception:
        raise


def test_ready_table_may_still_have_optional_open_seats() -> None:
    try:
        requirements = evaluate_requirements_snapshot(
            make_table(with_gm=True, with_venue=True),
            confirmed_players=4,
            venue_approval_required=False,
            venue_approved=False,
        )

        assert requirements.minimum_players_missing == 0
        assert requirements.open_player_seats == 2
        assert requirements.ready_to_confirm is True
    except Exception:
        raise


def test_required_venue_approval_blocks_readiness() -> None:
    try:
        game_table = make_table(with_gm=True, with_venue=True)
        pending = evaluate_requirements_snapshot(
            game_table,
            confirmed_players=4,
            venue_approval_required=True,
            venue_approved=False,
        )
        approved = evaluate_requirements_snapshot(
            game_table,
            confirmed_players=4,
            venue_approval_required=True,
            venue_approved=True,
        )

        assert pending.needs_venue_approval is True
        assert pending.ready_to_confirm is False
        assert approved.needs_venue_approval is False
        assert approved.ready_to_confirm is True
    except Exception:
        raise


def test_confirmed_players_cannot_exceed_table_capacity() -> None:
    try:
        with pytest.raises(GameTableRequirementsError, match="exceed Table capacity"):
            evaluate_requirements_snapshot(
                make_table(with_gm=True, with_venue=True),
                confirmed_players=7,
                venue_approval_required=False,
                venue_approved=False,
            )
    except Exception:
        raise


def test_only_fully_satisfied_forming_table_transitions_to_ready() -> None:
    try:
        game_table = make_table(with_gm=True, with_venue=True)
        requirements = evaluate_requirements_snapshot(
            game_table,
            confirmed_players=4,
            venue_approval_required=False,
            venue_approved=False,
        )

        transition_game_table_to_ready(game_table, requirements)

        assert game_table.lifecycle_status == GameTableStatus.READY.value
    except Exception:
        raise


def test_transition_rejects_unmet_requirements() -> None:
    try:
        game_table = make_table()
        requirements = evaluate_requirements_snapshot(
            game_table,
            confirmed_players=1,
            venue_approval_required=False,
            venue_approved=False,
        )

        with pytest.raises(GameTableTransitionError, match="unmet formation requirements"):
            transition_game_table_to_ready(game_table, requirements)
    except Exception:
        raise
