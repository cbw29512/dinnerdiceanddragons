"""Waitlist-promotion regression with production autoflush disabled."""

from sqlalchemy.orm import Session
from table_formation_test_support import (
    add_eligible_player,
    create_formation_session,
    seed_formation_parents,
)

from app.models.registration import Registration, RegistrationStatus
from app.models.venue_booking_request import VenueBookingRequest, VenueBookingStatus
from app.services.event_registration_service import (
    cancel_my_registration,
    decide_event_registration,
    request_event_registration,
)
from app.services.table_formation_conversion import form_table_match
from app.services.venue_booking_transitions import transition_venue_booking


def test_confirmed_cancellation_promotes_waitlist_without_implicit_autoflush() -> None:
    bootstrap, engine = create_formation_session()
    bootstrap.close()
    session = Session(engine, autoflush=False, expire_on_commit=False)
    try:
        seed = seed_formation_parents(session)
        seed.gm_supply.maximum_players = 1
        seed.table_match.maximum_players = 1
        second_user, _ = add_eligible_player(session, seed, suffix="no-autoflush")
        formed = form_table_match(
            session,
            table_match_id=seed.table_match.id,
            caller_user_id=seed.gm_user.id,
            title="No Autoflush Waitlist",
        )
        booking = session.get(VenueBookingRequest, formed.venue_booking_request_id)
        assert booking is not None
        transition_venue_booking(
            session,
            booking_id=booking.id,
            caller_user_id=seed.venue_manager_user.id,
            target_status=VenueBookingStatus.APPROVED.value,
        )

        first = request_event_registration(
            session,
            event_id=formed.event_id,
            caller_user_id=seed.player_user.id,
            expectations_acknowledged=True,
        )
        decide_event_registration(
            session,
            event_id=formed.event_id,
            registration_id=first.registration_id,
            caller_user_id=seed.gm_user.id,
            target_status=RegistrationStatus.CONFIRMED.value,
        )
        second = request_event_registration(
            session,
            event_id=formed.event_id,
            caller_user_id=second_user.id,
            expectations_acknowledged=True,
        )
        assert second.status == RegistrationStatus.WAITLISTED.value

        cancelled = cancel_my_registration(
            session,
            event_id=formed.event_id,
            caller_user_id=seed.player_user.id,
        )

        promoted = session.get(Registration, second.registration_id)
        assert promoted is not None
        assert promoted.status == RegistrationStatus.CONFIRMED.value
        assert cancelled.expected_guests == 2
    finally:
        session.close()
        engine.dispose()
