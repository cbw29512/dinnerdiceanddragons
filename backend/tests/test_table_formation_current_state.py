"""Current-state validation tests for new Table Match formation."""

from datetime import UTC, datetime

import pytest
from sqlalchemy import delete
from table_formation_test_support import create_formation_session, seed_formation_inputs

from app.models.matching_signal import SignalStatus
from app.models.user import AccountStatus
from app.models.user_role import UserRole, UserRoleType
from app.schemas.table_formation import FormTableMatchRequest, TableExpectationsInput
from app.services.table_formation_conversion import form_table_match
from app.services.table_formation_errors import (
    FormationConflictError,
    FormationForbiddenError,
)


def _payload() -> FormTableMatchRequest:
    return FormTableMatchRequest(
        title="Current Formation Test",
        description="Formation must revalidate current durable source state.",
        expected_sessions=1,
        expectations=TableExpectationsInput(
            play_style="Collaborative roleplay and tactical combat.",
            boundaries="Respectful table and consent-first PvP.",
        ),
    )


def test_suspended_gm_cannot_form_stale_match() -> None:
    session, engine = create_formation_session()
    try:
        seed = seed_formation_inputs(session)
        seed.gm_user.status = AccountStatus.SUSPENDED.value
        session.commit()
        with pytest.raises(FormationForbiddenError):
            form_table_match(session, seed.gm_user, seed.match.id, _payload())
    finally:
        session.close()
        engine.dispose()


def test_removed_gm_role_cannot_form_stale_match() -> None:
    session, engine = create_formation_session()
    try:
        seed = seed_formation_inputs(session)
        session.execute(
            delete(UserRole).where(
                UserRole.user_id == seed.gm_user.id,
                UserRole.role == UserRoleType.GM.value,
            )
        )
        session.commit()
        with pytest.raises(FormationForbiddenError):
            form_table_match(session, seed.gm_user, seed.match.id, _payload())
    finally:
        session.close()
        engine.dispose()


@pytest.mark.parametrize("signal_status", [SignalStatus.PAUSED.value, SignalStatus.EXPIRED.value])
def test_inactive_gm_supply_blocks_new_formation(signal_status: str) -> None:
    session, engine = create_formation_session()
    try:
        seed = seed_formation_inputs(session)
        seed.supply.status = signal_status
        session.commit()
        with pytest.raises(FormationConflictError):
            form_table_match(session, seed.gm_user, seed.match.id, _payload())
    finally:
        session.close()
        engine.dispose()


def test_changed_gm_player_bounds_require_rematching() -> None:
    session, engine = create_formation_session()
    try:
        seed = seed_formation_inputs(session)
        seed.supply.maximum_players = seed.match.maximum_players + 1
        session.commit()
        with pytest.raises(FormationConflictError):
            form_table_match(session, seed.gm_user, seed.match.id, _payload())
    finally:
        session.close()
        engine.dispose()


@pytest.mark.parametrize("venue_change", ["inactive", "unverified"])
def test_ineligible_venue_blocks_new_formation(venue_change: str) -> None:
    session, engine = create_formation_session()
    try:
        seed = seed_formation_inputs(session)
        if venue_change == "inactive":
            seed.venue.active = False
        else:
            seed.venue.verified = False
        session.commit()
        with pytest.raises(FormationConflictError):
            form_table_match(session, seed.gm_user, seed.match.id, _payload())
    finally:
        session.close()
        engine.dispose()


def test_inactive_venue_window_blocks_new_formation() -> None:
    session, engine = create_formation_session()
    try:
        seed = seed_formation_inputs(session)
        seed.window.active = False
        session.commit()
        with pytest.raises(FormationConflictError):
            form_table_match(session, seed.gm_user, seed.match.id, _payload())
    finally:
        session.close()
        engine.dispose()


def test_reduced_per_table_capacity_blocks_new_formation() -> None:
    session, engine = create_formation_session()
    try:
        seed = seed_formation_inputs(session)
        seed.window.max_people_per_table = seed.match.maximum_players
        session.commit()
        with pytest.raises(FormationConflictError):
            form_table_match(session, seed.gm_user, seed.match.id, _payload())
    finally:
        session.close()
        engine.dispose()


def test_inactive_game_system_blocks_new_formation() -> None:
    session, engine = create_formation_session()
    try:
        seed = seed_formation_inputs(session)
        seed.system.active = False
        session.commit()
        with pytest.raises(FormationConflictError):
            form_table_match(session, seed.gm_user, seed.match.id, _payload())
    finally:
        session.close()
        engine.dispose()


def test_past_occurrence_blocks_new_formation() -> None:
    session, engine = create_formation_session()
    try:
        seed = seed_formation_inputs(session)
        seed.match.proposed_start = datetime(2020, 1, 1, 18, tzinfo=UTC)
        seed.match.proposed_end = datetime(2020, 1, 1, 22, tzinfo=UTC)
        session.commit()
        with pytest.raises(FormationConflictError):
            form_table_match(session, seed.gm_user, seed.match.id, _payload())
    finally:
        session.close()
        engine.dispose()
