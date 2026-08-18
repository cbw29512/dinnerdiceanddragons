"""Tests for GM-owned shared Event expectations editing and freeze behavior."""

import pytest
from sqlalchemy.orm import Session
from table_formation_test_support import create_formation_session, seed_formation_parents

from app.models.event import Event
from app.services.event_expectations_update import update_event_expectations
from app.services.event_registration_service import request_event_registration
from app.services.table_formation_conversion import form_table_match
from app.services.table_formation_errors import (
    TableFormationConflictError,
    TableFormationNotFoundError,
)


@pytest.fixture()
def session() -> Session:
    db, engine = create_formation_session()
    try:
        yield db
    finally:
        db.close()
        engine.dispose()


def test_owning_gm_can_define_expectations_before_registration(session: Session) -> None:
    seed, event = _formed_event(session)

    updated = update_event_expectations(
        session,
        event_id=event.id,
        caller_user_id=seed.gm_user.id,
        values={
            "tone": "Heroic adventure",
            "pvp_policy": "No PvP without unanimous consent.",
            "safety_framework": "Lines and veils plus X-card.",
            "new_players_welcome": True,
        },
    )

    assert updated.tone == "Heroic adventure"
    assert updated.pvp_policy == "No PvP without unanimous consent."
    assert updated.safety_framework == "Lines and veils plus X-card."
    assert updated.new_players_welcome is True


def test_non_owner_cannot_edit_event_expectations(session: Session) -> None:
    seed, event = _formed_event(session)

    with pytest.raises(TableFormationNotFoundError):
        update_event_expectations(
            session,
            event_id=event.id,
            caller_user_id=seed.player_user.id,
            values={"tone": "Unauthorized"},
        )


def test_expectations_freeze_after_first_registration(session: Session) -> None:
    seed, event = _formed_event(session)
    request_event_registration(
        session,
        event_id=event.id,
        caller_user_id=seed.player_user.id,
        expectations_acknowledged=True,
    )

    with pytest.raises(TableFormationConflictError, match="frozen"):
        update_event_expectations(
            session,
            event_id=event.id,
            caller_user_id=seed.gm_user.id,
            values={"tone": "Changed after acknowledgement"},
        )


def _formed_event(session: Session):
    seed = seed_formation_parents(session)
    result = form_table_match(
        session,
        table_match_id=seed.table_match.id,
        caller_user_id=seed.gm_user.id,
        title="Expectations Test",
    )
    event = session.get(Event, result.event_id)
    assert event is not None
    return seed, event
