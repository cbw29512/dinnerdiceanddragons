"""Transaction-level tests for Player seats, waitlists, and Event state."""

from sqlalchemy import select

from app.models.event import Event
from app.models.registration import Registration, RegistrationStatus
from app.models.user import User
from app.models.venue_booking_request import VenueBookingRequest
from app.services.gm_registration_service import decide_registration
from app.services.player_registration_service import cancel_registration, request_registration
from event_lifecycle_test_support import build_lifecycle_factory


def test_instant_join_waitlists_then_promotes_after_confirmed_cancel() -> None:
    factory, seed = build_lifecycle_factory(player_count=2)

    with factory() as session:
        first = request_registration(session, seed.player_users[0], seed.event_id)
    assert first.status == RegistrationStatus.CONFIRMED.value

    with factory() as session:
        second = request_registration(session, seed.player_users[1], seed.event_id)
    assert second.status == RegistrationStatus.WAITLISTED.value

    with factory() as session:
        event = session.get(Event, seed.event_id)
        booking = session.get(VenueBookingRequest, seed.booking_id)
        assert event is not None and booking is not None
        assert event.status == "full"
        assert booking.expected_guests == 2

    with factory() as session:
        cancelled = cancel_registration(session, seed.player_users[0], seed.event_id)
    assert cancelled.status == RegistrationStatus.CANCELLED.value

    with factory() as session:
        registrations = session.scalars(
            select(Registration).where(Registration.event_id == seed.event_id)
        ).all()
        statuses = {item.player_profile_id: item.status for item in registrations}
        second_profile_id = next(
            item.player_profile_id for item in registrations if item.id == second.id
        )
        assert statuses[second_profile_id] == RegistrationStatus.CONFIRMED.value
        event = session.get(Event, seed.event_id)
        booking = session.get(VenueBookingRequest, seed.booking_id)
        assert event is not None and booking is not None
        assert event.status == "full"
        assert booking.expected_guests == 2


def test_request_to_join_requires_owning_gm_confirmation() -> None:
    factory, seed = build_lifecycle_factory(player_count=1)
    with factory() as session:
        event = session.get(Event, seed.event_id)
        assert event is not None
        event.join_mode = "request_to_join"
        session.commit()

    with factory() as session:
        requested = request_registration(session, seed.player_users[0], seed.event_id)
    assert requested.status == RegistrationStatus.REQUESTED.value

    with factory() as session:
        event = session.get(Event, seed.event_id)
        booking = session.get(VenueBookingRequest, seed.booking_id)
        assert event is not None and booking is not None
        assert event.status == "forming"
        assert booking.expected_guests == 1
        gm_user = session.scalar(
            select(User).where(User.auth_provider_user_id == "lifecycle-gm")
        )
        assert gm_user is not None

    with factory() as session:
        confirmed = decide_registration(
            session,
            gm_user,
            seed.event_id,
            requested.id,
            "confirm",
        )
    assert confirmed.status == RegistrationStatus.CONFIRMED.value

    with factory() as session:
        event = session.get(Event, seed.event_id)
        booking = session.get(VenueBookingRequest, seed.booking_id)
        assert event is not None and booking is not None
        assert event.status == "full"
        assert booking.expected_guests == 2
