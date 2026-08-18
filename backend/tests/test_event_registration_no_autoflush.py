"""Regression tests using the production session factory's autoflush=False behavior."""

from sqlalchemy.orm import Session
from table_formation_test_support import create_formation_session, seed_formation_parents

from app.models.event import EventStatus
from app.models.registration import RegistrationStatus
from app.models.venue_booking_request import VenueBookingRequest, VenueBookingStatus
from app.services.event_registration_service import decide_event_registration, request_event_registration
from app.services.table_formation_conversion import form_table_match
from app.services.venue_booking_transitions import transition_venue_booking


def test_confirmed_seat_reconciles_headcount_without_implicit_autoflush() -> None:
    bootstrap, engine = create_formation_session()
    bootstrap.close()
    session = Session(engine, autoflush=False, expire_on_commit=False)
    try:
        seed = seed_formation_parents(session)
        formed = form_table_match(
            session,
            table_match_id=seed.table_match.id,
            caller_user_id=seed.gm_user.id,
            title="No Autoflush",
        )
        booking = session.get(VenueBookingRequest, formed.venue_booking_request_id)
        assert booking is not None
        transition_venue_booking(
            session,
            booking_id=booking.id,
            caller_user_id=seed.venue_manager_user.id,
            target_status=VenueBookingStatus.APPROVED.value,
        )

        requested = request_event_registration(
            session,
            event_id=formed.event_id,
            caller_user_id=seed.player_user.id,
            expectations_acknowledged=True,
        )
        confirmed = decide_event_registration(
            session,
            event_id=formed.event_id,
            registration_id=requested.registration_id,
            caller_user_id=seed.gm_user.id,
            target_status=RegistrationStatus.CONFIRMED.value,
        )

        assert confirmed.status == RegistrationStatus.CONFIRMED.value
        assert confirmed.event_status == EventStatus.CONFIRMED.value
        assert confirmed.expected_guests == 2
    finally:
        session.close()
        engine.dispose()
