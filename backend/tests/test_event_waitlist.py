"""Capacity, waitlist, and cancellation-promotion tests for formed Events."""

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy.orm import Session
from table_formation_test_support import (
    add_eligible_player,
    create_formation_session,
    seed_formation_parents,
)

from app.models.event import Event, EventStatus
from app.models.registration import Registration, RegistrationStatus
from app.models.venue_booking_request import VenueBookingRequest, VenueBookingStatus
from app.services.event_registration_service import (
    cancel_my_registration,
    decide_event_registration,
    request_event_registration,
)
from app.services.table_formation_conversion import form_table_match
from app.services.venue_booking_transitions import transition_venue_booking


@pytest.fixture()
def session() -> Session:
    db, engine = create_formation_session()
    try:
        yield db
    finally:
        db.close()
        engine.dispose()


def form_one_seat_event(session: Session):
    seed = seed_formation_parents(session)
    seed.table_match.maximum_players = 1
    second_user, _ = add_eligible_player(session, seed, suffix="two")
    third_user, _ = add_eligible_player(session, seed, suffix="three")
    formed = form_table_match(
        session,
        table_match_id=seed.table_match.id,
        caller_user_id=seed.gm_user.id,
        title="One Seat Table",
    )
    booking = session.get(VenueBookingRequest, formed.venue_booking_request_id)
    assert booking is not None
    transition_venue_booking(
        session,
        booking_id=booking.id,
        caller_user_id=seed.venue_manager_user.id,
        target_status=VenueBookingStatus.APPROVED.value,
    )
    return seed, second_user, third_user, formed


def test_full_event_waitlists_additional_eligible_player(session: Session) -> None:
    seed, second_user, _, formed = form_one_seat_event(session)
    first = _request(session, formed.event_id, seed.player_user.id)
    confirmed = _confirm(session, formed.event_id, first.registration_id, seed.gm_user.id)
    second = _request(session, formed.event_id, second_user.id)

    assert confirmed.status == RegistrationStatus.CONFIRMED.value
    assert confirmed.event_status == EventStatus.FULL.value
    assert confirmed.expected_guests == 2
    assert second.status == RegistrationStatus.WAITLISTED.value
    assert second.event_status == EventStatus.FULL.value
    assert second.expected_guests == 2


def test_confirmed_cancellation_promotes_earliest_waitlisted_player(session: Session) -> None:
    seed, second_user, third_user, formed = form_one_seat_event(session)
    first = _request(session, formed.event_id, seed.player_user.id)
    _confirm(session, formed.event_id, first.registration_id, seed.gm_user.id)
    second = _request(session, formed.event_id, second_user.id)
    third = _request(session, formed.event_id, third_user.id)

    second_registration = session.get(Registration, second.registration_id)
    third_registration = session.get(Registration, third.registration_id)
    assert second_registration is not None and third_registration is not None
    base = datetime(2026, 8, 18, 1, 0, tzinfo=UTC)
    second_registration.requested_at = base
    third_registration.requested_at = base + timedelta(minutes=1)
    session.commit()

    cancelled = cancel_my_registration(
        session,
        event_id=formed.event_id,
        caller_user_id=seed.player_user.id,
    )

    second_registration = session.get(Registration, second.registration_id)
    third_registration = session.get(Registration, third.registration_id)
    first_registration = session.get(Registration, first.registration_id)
    event = session.get(Event, formed.event_id)
    assert first_registration is not None
    assert second_registration is not None
    assert third_registration is not None
    assert event is not None
    assert first_registration.status == RegistrationStatus.CANCELLED.value
    assert second_registration.status == RegistrationStatus.CONFIRMED.value
    assert third_registration.status == RegistrationStatus.WAITLISTED.value
    assert cancelled.event_status == EventStatus.FULL.value
    assert cancelled.expected_guests == 2
    assert event.status == EventStatus.FULL.value


def _request(session: Session, event_id, user_id):
    return request_event_registration(
        session,
        event_id=event_id,
        caller_user_id=user_id,
        expectations_acknowledged=True,
    )


def _confirm(session: Session, event_id, registration_id, gm_user_id):
    return decide_event_registration(
        session,
        event_id=event_id,
        registration_id=registration_id,
        caller_user_id=gm_user_id,
        target_status=RegistrationStatus.CONFIRMED.value,
    )
