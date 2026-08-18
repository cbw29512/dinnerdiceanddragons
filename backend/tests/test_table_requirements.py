"""Unit tests for the V1 Table formation requirements contract."""

from uuid import uuid4

import pytest

from app.models.game_table import GameTable, TableLifecycleStatus
from app.services.table_requirements import (
    TableStateError,
    evaluate_table_requirements,
    transition_table_to_ready,
)


def make_table(*, with_gm: bool = False, with_venue: bool = False) -> GameTable:
    """Build an unpersisted Table aggregate for deterministic domain tests."""

    try:
        return GameTable(
            game_system_id=uuid4(),
            created_by_user_id=uuid4(),
            title="Florence Beginner Table",
            lifecycle_status=TableLifecycleStatus.FORMING.value,
            minimum_players=4,
            maximum_players=6,
            gm_profile_id=uuid4() if with_gm else None,
            venue_id=uuid4() if with_venue else None,
        )
    except Exception:
        pytest.fail("Test fixture failed to construct GameTable")


def test_forming_table_can_need_multiple_resources_at_once() -> None:
    try:
        game_table = make_table()

        requirements = evaluate_table_requirements(
            game_table,
            committed_players=2,
            has_schedule=False,
        )

        assert requirements.needs_gm is True
        assert requirements.minimum_players_missing == 2
        assert requirements.open_player_seats == 4
        assert requirements.needs_venue is True
        assert requirements.needs_schedule is True
        assert requirements.ready_to_confirm is False
    except Exception:
        raise


def test_ready_does_not_require_every_optional_seat_to_be_filled() -> None:
    try:
        game_table = make_table(with_gm=True, with_venue=True)

        requirements = evaluate_table_requirements(
            game_table,
            committed_players=4,
            has_schedule=True,
        )

        assert requirements.minimum_players_missing == 0
        assert requirements.open_player_seats == 2
        assert requirements.ready_to_confirm is True
    except Exception:
        raise


def test_required_venue_approval_blocks_readiness_until_approved() -> None:
    try:
        game_table = make_table(with_gm=True, with_venue=True)

        pending = evaluate_table_requirements(
            game_table,
            committed_players=4,
            has_schedule=True,
            venue_approval_required=True,
            venue_approved=False,
        )
        approved = evaluate_table_requirements(
            game_table,
            committed_players=4,
            has_schedule=True,
            venue_approval_required=True,
            venue_approved=True,
        )

        assert pending.needs_venue_approval is True
        assert pending.ready_to_confirm is False
        assert approved.needs_venue_approval is False
        assert approved.ready_to_confirm is True
    except Exception:
        raise


def test_committed_players_cannot_exceed_capacity() -> None:
    try:
        game_table = make_table(with_gm=True, with_venue=True)

        with pytest.raises(ValueError, match="cannot exceed maximum_players"):
            evaluate_table_requirements(
                game_table,
                committed_players=7,
                has_schedule=True,
            )
    except Exception:
        raise


def test_forming_table_transitions_to_ready_only_when_requirements_are_met() -> None:
    try:
        game_table = make_table(with_gm=True, with_venue=True)
        requirements = evaluate_table_requirements(
            game_table,
            committed_players=4,
            has_schedule=True,
        )

        transitioned = transition_table_to_ready(game_table, requirements)

        assert transitioned.lifecycle_status == TableLifecycleStatus.READY.value
    except Exception:
        raise


def test_transition_to_ready_rejects_unmet_requirements() -> None:
    try:
        game_table = make_table()
        requirements = evaluate_table_requirements(
            game_table,
            committed_players=1,
            has_schedule=False,
        )

        with pytest.raises(TableStateError, match="unmet formation requirements"):
            transition_table_to_ready(game_table, requirements)
    except Exception:
        raise
