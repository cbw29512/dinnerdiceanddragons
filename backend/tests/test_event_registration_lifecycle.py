"""End-to-end seat and Event-confirmation lifecycle tests."""

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session
from table_formation_test_support import create_formation_session, seed_formation_parents

from app.models.event import Event, EventStatus
from app.models.registration import Registration, RegistrationStatus
from app.models.venue_booking_request import VenueBookingRequest, VenueBookingStatus
from app.services.event_registration_service import (
    decide_event_registration,
    request_event_registration,
)
from app.services.table_formation_conversion import form_table_match
from app.services.table_formation_errors import (
    TableFormationConflictError,
    TableFormationNotFoundError,
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


def form_event(session: Session):
    seed = seed_formation_parents(session)
    formed = form_table_match(
        session,
        table_match_id=seed.table_match.id,
        caller_user_id=seed.gm_user.id,
        title="Registration Lifecycle",
    )
    event = session.get(Event, formed.event_id)
    booking = session.get(VenueBookingRequest, formed.venue_booking_request_id)
    assert event is not None and booking is not None
    return seed, formed, event, booking


def test_player_must_acknowledge_table_expectations(session: Session) -> None:
    seed, _, event, _ = form_event(session)

    with pytest.raises(TableFormationConflictError):
        request_event_registration(
            session,
            event_id=event.id,
            caller_user_id=seed.player_user.id,
            expectations_acknowledged=False,
        )


def test_confirmed_player_does_not_confirm_event_before_venue_approval(session: Session) -> None:
    seed, _, event, booking = form_event(session)
    requested = request_event_registration(
        session,
        event_id=event.id,
        caller_user_id=seed.player_user.id,
        expectations_acknowledged=True,
    )
    confirmed = decide_event_registration(
        session,
        event_id=event.id,
        registration_id=requested.registration_id,
        caller_user_id=seed.gm_user.id,
        target_status=RegistrationStatus.CONFIRMED.value,
    )

    assert confirmed.status == RegistrationStatus.CONFIRMED.value
    assert confirmed.event_status == EventStatus.VENUE_REQUESTED.value
    assert confirmed.expected_guests == 2
    assert booking.status == VenueBookingStatus.REQUESTED.value


def test_venue_approval_plus_minimum_commitment_confirms_event(session: Session) -> None:
    seed, _, event, booking = form_event(session)
    requested = request_event_registration(
        session,
        event_id=event.id,
        caller_user_id=seed.player_user.id,
        expectations_acknowledged=True,
    )
    decide_event_registration(
        session,
        event_id=event.id,
        registration_id=requested.registration_id,
        caller_user_id=seed.gm_user.id,
        target_status=RegistrationStatus.CONFIRMED.value,
    )

    approved = transition_venue_booking(
        session,
        booking_id=booking.id,
        caller_user_id=seed.venue_manager_user.id,
        target_status=VenueBookingStatus.APPROVED.value,
    )

    assert approved.event_status == EventStatus.CONFIRMED.value
    assert approved.expected_guests == 2
    refreshed = session.get(Event, event.id)
    assert refreshed is not None
    assert refreshed.status == EventStatus.CONFIRMED.value


def test_non_owner_cannot_make_gm_registration_decision(session: Session) -> None:
    seed, _, event, _ = form_event(session)
    requested = request_event_registration(
        session,
        event_id=event.id,
        caller_user_id=seed.player_user.id,
        expectations_acknowledged=True,
    )

    with pytest.raises(TableFormationNotFoundError):
        decide_event_registration(
            session,
            event_id=event.id,
            registration_id=requested.registration_id,
            caller_user_id=seed.player_user.id,
            target_status=RegistrationStatus.CONFIRMED.value,
        )


def test_registration_request_is_idempotent_for_active_request(session: Session) -> None:
    seed, _, event, _ = form_event(session)

    first = request_event_registration(
        session,
        event_id=event.id,
        caller_user_id=seed.player_user.id,
        expectations_acknowledged=True,
    )
    second = request_event_registration(
        session,
        event_id=event.id,
        caller_user_id=seed.player_user.id,
        expectations_acknowledged=True,
    )

    assert first.registration_id == second.registration_id
    registrations = session.scalars(select(Registration)).all()
    assert len(registrations) == 1
