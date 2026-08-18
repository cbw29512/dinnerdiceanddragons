"""Tests for idempotent single- and multi-session Table Match conversion."""

from sqlalchemy import func, select
from table_formation_test_support import (
    create_formation_session,
    seed_formation_inputs,
)

from app.models.event import Event
from app.models.game_series import GameSeries
from app.models.game_table import GameTable
from app.models.game_table_player import GameTablePlayer, GameTablePlayerStatus
from app.models.user import User
from app.models.venue_booking_request import VenueBookingRequest
from app.schemas.table_formation import FormTableMatchRequest, TableExpectationsInput
from app.services.game_table_from_match import materialize_game_table_from_match
from app.services.table_formation_builders import load_formation_parents
from app.services.table_formation_conversion import form_table_match


def _payload(expected_sessions: int = 4) -> FormTableMatchRequest:
    return FormTableMatchRequest(
        title="Four Fridays in Florence",
        description="A short campaign created from one viable Table Match.",
        event_type="new_campaign",
        join_mode="request_to_join",
        expected_sessions=expected_sessions,
        expectations=TableExpectationsInput(
            play_style="Collaborative roleplay and tactical combat.",
            boundaries="Respectful table and consent-first PvP.",
        ),
    )


def test_multi_session_conversion_creates_one_series_and_is_idempotent() -> None:
    session, engine = create_formation_session()
    try:
        seed = seed_formation_inputs(session)
        gm_user = session.get(User, seed.gm.user_id)
        assert gm_user is not None

        first = form_table_match(session, gm_user, seed.match.id, _payload())
        second = form_table_match(session, gm_user, seed.match.id, _payload())

        assert first.created is True
        assert second.created is False
        assert first.game_table_id is not None
        assert first.game_table_id == second.game_table_id
        assert first.event_id == second.event_id
        assert first.game_series_id is not None
        assert first.game_series_id == second.game_series_id
        assert first.venue_booking_request_id == second.venue_booking_request_id
        assert session.scalar(select(func.count()).select_from(GameTable)) == 1
        assert session.scalar(select(func.count()).select_from(GameSeries)) == 1
        assert session.scalar(select(func.count()).select_from(Event)) == 1
        assert session.scalar(select(func.count()).select_from(VenueBookingRequest)) == 1

        event = session.get(Event, first.event_id)
        assert event is not None
        assert event.game_table_id == first.game_table_id

        memberships = session.scalars(
            select(GameTablePlayer).where(GameTablePlayer.game_table_id == first.game_table_id)
        ).all()
        assert len(memberships) == 3
        assert {member.status for member in memberships} == {GameTablePlayerStatus.INVITED.value}
    finally:
        session.close()
        engine.dispose()


def test_pre_materialized_boom_table_is_reused_when_gm_forms_event() -> None:
    session, engine = create_formation_session()
    try:
        seed = seed_formation_inputs(session)
        gm_user = session.get(User, seed.gm.user_id)
        assert gm_user is not None
        parents = load_formation_parents(session, seed.match)

        boom_table = materialize_game_table_from_match(session, seed.match, parents)
        boom_table_id = boom_table.id
        session.commit()

        response = form_table_match(session, gm_user, seed.match.id, _payload(expected_sessions=1))

        assert response.created is True
        assert response.game_table_id == boom_table_id
        assert session.scalar(select(func.count()).select_from(GameTable)) == 1
        persisted = session.get(GameTable, boom_table_id)
        assert persisted is not None
        assert persisted.title == "Four Fridays in Florence"
    finally:
        session.close()
        engine.dispose()
