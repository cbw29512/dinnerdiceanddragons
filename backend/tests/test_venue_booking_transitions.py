"""Transaction tests for verified Venue booking lifecycle operations."""

import pytest
from sqlalchemy.orm import Session
from table_formation_test_support import create_formation_session, seed_formation_parents

from app.models.event import Event, EventStatus
from app.models.venue_booking_request import VenueBookingRequest, VenueBookingStatus
from app.services.table_formation_conversion import form_table_match
from app.services.table_formation_errors import (
    TableFormationConflictError,
    TableFormationForbiddenError,
)
from app.services.venue_booking_transitions import transition_venue_booking


@pytest.fixture()
def session() -> Session:
    db, engine = create_formation_session()
    try:
        yield db
    finally:
        db.close()
        engine.dispose()


def formed_booking(session: Session):
    seed = seed_formation_parents(session)
    formed = form_table_match(
        session,
        table_match_id=seed.table_match.id,
        caller_user_id=seed.gm_user.id,
        title="Venue Approval Test",
    )
    return seed, formed, session.get(VenueBookingRequest, formed.venue_booking_request_id)


def test_verified_manager_can_approve_booking_and_event_moves_to_forming(session: Session) -> None:
    seed, formed, booking = formed_booking(session)
    assert booking is not None

    result = transition_venue_booking(
        session,
        booking_id=booking.id,
        caller_user_id=seed.venue_manager_user.id,
        target_status=VenueBookingStatus.APPROVED.value,
    )

    assert result.status == VenueBookingStatus.APPROVED.value
    assert result.event_status == EventStatus.FORMING.value
    assert result.expected_guests == 1
    event = session.get(Event, formed.event_id)
    assert event is not None
    assert event.status == EventStatus.FORMING.value


def test_verified_manager_can_request_question_then_decline(session: Session) -> None:
    seed, _, booking = formed_booking(session)
    assert booking is not None

    questioned = transition_venue_booking(
        session,
        booking_id=booking.id,
        caller_user_id=seed.venue_manager_user.id,
        target_status=VenueBookingStatus.QUESTION.value,
        venue_message="Can the table start 30 minutes later?",
    )
    declined = transition_venue_booking(
        session,
        booking_id=booking.id,
        caller_user_id=seed.venue_manager_user.id,
        target_status=VenueBookingStatus.DECLINED.value,
    )

    assert questioned.event_status == EventStatus.VENUE_REQUESTED.value
    assert declined.status == VenueBookingStatus.DECLINED.value
    assert declined.event_status == EventStatus.CANCELLED.value


def test_unrelated_user_cannot_transition_venue_booking(session: Session) -> None:
    seed, _, booking = formed_booking(session)
    assert booking is not None

    with pytest.raises(TableFormationForbiddenError):
        transition_venue_booking(
            session,
            booking_id=booking.id,
            caller_user_id=seed.player_user.id,
            target_status=VenueBookingStatus.APPROVED.value,
        )


def test_overlapping_approved_booking_consumes_last_table(session: Session) -> None:
    seed, _, booking = formed_booking(session)
    assert booking is not None
    seed.venue_window.table_count = 1

    competing_event = Event(
        slug="already-approved-event",
        title="Already Approved Event",
        gm_profile_id=seed.gm_profile.id,
        game_system_id=seed.system.id,
        venue_id=seed.venue.id,
        event_type="one_shot",
        join_mode="request",
        status=EventStatus.FORMING.value,
        starts_at=booking.requested_start,
        ends_at=booking.requested_end,
        min_players=1,
        max_players=5,
    )
    session.add(competing_event)
    session.flush()
    session.add(
        VenueBookingRequest(
            venue_table_window_id=seed.venue_window.id,
            gm_profile_id=seed.gm_profile.id,
            event_id=competing_event.id,
            requested_start=competing_event.starts_at,
            requested_end=competing_event.ends_at,
            tables_requested=1,
            expected_guests=1,
            status=VenueBookingStatus.APPROVED.value,
        )
    )
    session.commit()

    with pytest.raises(TableFormationConflictError):
        transition_venue_booking(
            session,
            booking_id=booking.id,
            caller_user_id=seed.venue_manager_user.id,
            target_status=VenueBookingStatus.APPROVED.value,
        )
