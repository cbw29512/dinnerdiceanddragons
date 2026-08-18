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
from app.services.table_formation_conversion import form_table_match


def test_multi_session_conversion_creates_one_series_and_is_idempotent() -> None:
    session, engine = create_formation_session()
    try:
        seed = seed_formation_inputs(session)
        gm_user = session.get(User, seed.gm.user_id)
        assert gm_user is not None
        payload = FormTableMatchRequest(
            title="Four Fridays in Florence",
            description="A short campaign created from one viable Table Match.",
            event_type="new_campaign",
            join_mode="request_to_join",
            expected_sessions=4,
            expectations=TableExpectationsInput(
                play_style="Collaborative roleplay and tactical combat.",
                boundaries="Respectful table and consent-first PvP.",
            ),
        )

        first = form_table_match(session, gm_user, seed.match.id, payload)
        second = form_table_match(session, gm_user, seed.match.id, payload)

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
            select(GameTablePlayer).where(
                GameTablePlayer.game_table_id == first.game_table_id
            )
        ).all()
        assert len(memberships) == 3
        assert {member.status for member in memberships} == {
            GameTablePlayerStatus.INVITED.value
        }
    finally:
        session.close()
        engine.dispose()
