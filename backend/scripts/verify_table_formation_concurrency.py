"""Real PostgreSQL race checks for Venue capacity and Event seat serialization."""

from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from threading import Barrier
from uuid import uuid4

from sqlalchemy import select

from app.db.session import get_session_factory
from app.models.event import Event, EventStatus
from app.models.game_system import GameSystem
from app.models.gm_profile import GMProfile
from app.models.player_profile import PlayerProfile
from app.models.registration import Registration, RegistrationStatus
from app.models.recurring_availability_rule import RecurringAvailabilityRule
from app.models.user import AccountStatus, User
from app.models.user_role import UserRole, UserRoleType
from app.models.venue import Venue, VenueManager
from app.models.venue_booking_request import VenueBookingRequest, VenueBookingStatus
from app.models.venue_table_window import VenueTableWindow
from app.services.event_registration_service import decide_event_registration
from app.services.table_formation_errors import TableFormationConflictError
from app.services.venue_booking_transitions import transition_venue_booking

FACTORY = get_session_factory()
START = datetime(2026, 9, 4, 22, 0, tzinfo=UTC)
END = START + timedelta(hours=4)


def main() -> None:
    """Run both races against the live contract PostgreSQL database."""

    booking_ids, manager_user_id = seed_booking_race()
    verify_booking_race(booking_ids, manager_user_id)

    event_id, registration_ids, gm_user_id = seed_seat_race()
    verify_seat_race(event_id, registration_ids, gm_user_id)
    print("Table formation PostgreSQL concurrency verification passed.")


def seed_booking_race():
    with FACTORY() as session:
        system = _system(session)
        gm_user, gm_profile = _gm(session, "booking-race")
        manager = _user("booking-manager")
        session.add(manager)
        session.flush()
        session.add(UserRole(user_id=manager.id, role=UserRoleType.VENUE_MANAGER.value))

        venue, window = _venue_window(session, "booking-race", table_count=1)
        session.add(
            VenueManager(
                venue_id=venue.id,
                user_id=manager.id,
                role="manager",
                verified_at=datetime.now(UTC),
            )
        )
        session.flush()

        booking_ids = []
        for index in range(2):
            event = _event(
                system=system,
                gm_profile=gm_profile,
                venue=venue,
                slug=f"booking-race-{index}-{uuid4().hex[:8]}",
                max_players=5,
            )
            session.add(event)
            session.flush()
            booking = VenueBookingRequest(
                venue_table_window_id=window.id,
                gm_profile_id=gm_profile.id,
                event_id=event.id,
                requested_start=START,
                requested_end=END,
                tables_requested=1,
                expected_guests=1,
                status=VenueBookingStatus.REQUESTED.value,
            )
            session.add(booking)
            session.flush()
            booking_ids.append(booking.id)
        session.commit()
        return tuple(booking_ids), manager.id


def verify_booking_race(booking_ids, manager_user_id) -> None:
    barrier = Barrier(2)

    def approve(booking_id):
        with FACTORY() as session:
            barrier.wait()
            try:
                transition_venue_booking(
                    session,
                    booking_id=booking_id,
                    caller_user_id=manager_user_id,
                    target_status=VenueBookingStatus.APPROVED.value,
                )
                return "approved"
            except TableFormationConflictError:
                return "conflict"

    with ThreadPoolExecutor(max_workers=2) as pool:
        outcomes = list(pool.map(approve, booking_ids))
    assert sorted(outcomes) == ["approved", "conflict"], outcomes

    with FACTORY() as session:
        statuses = session.scalars(
            select(VenueBookingRequest.status).where(
                VenueBookingRequest.id.in_(booking_ids)
            )
        ).all()
        assert statuses.count(VenueBookingStatus.APPROVED.value) == 1, statuses
        assert statuses.count(VenueBookingStatus.REQUESTED.value) == 1, statuses


def seed_seat_race():
    with FACTORY() as session:
        system = _system(session)
        gm_user, gm_profile = _gm(session, "seat-race")
        venue, window = _venue_window(session, "seat-race", table_count=1)
        event = _event(
            system=system,
            gm_profile=gm_profile,
            venue=venue,
            slug=f"seat-race-{uuid4().hex[:8]}",
            max_players=1,
        )
        session.add(event)
        session.flush()
        booking = VenueBookingRequest(
            venue_table_window_id=window.id,
            gm_profile_id=gm_profile.id,
            event_id=event.id,
            requested_start=START,
            requested_end=END,
            tables_requested=1,
            expected_guests=1,
            status=VenueBookingStatus.APPROVED.value,
        )
        session.add(booking)

        registration_ids = []
        for index in range(2):
            player = _user(f"seat-player-{index}-{uuid4().hex[:6]}")
            session.add(player)
            session.flush()
            session.add(UserRole(user_id=player.id, role=UserRoleType.PLAYER.value))
            profile = PlayerProfile(
                user_id=player.id,
                postal_code="29501",
                travel_radius_miles=25,
            )
            session.add(profile)
            session.flush()
            registration = Registration(
                event_id=event.id,
                player_profile_id=profile.id,
                status=RegistrationStatus.REQUESTED.value,
                expectations_acknowledged_at=datetime.now(UTC),
            )
            session.add(registration)
            session.flush()
            registration_ids.append(registration.id)
        session.commit()
        return event.id, tuple(registration_ids), gm_user.id


def verify_seat_race(event_id, registration_ids, gm_user_id) -> None:
    barrier = Barrier(2)

    def confirm(registration_id):
        with FACTORY() as session:
            barrier.wait()
            result = decide_event_registration(
                session,
                event_id=event_id,
                registration_id=registration_id,
                caller_user_id=gm_user_id,
                target_status=RegistrationStatus.CONFIRMED.value,
            )
            return result.status

    with ThreadPoolExecutor(max_workers=2) as pool:
        outcomes = list(pool.map(confirm, registration_ids))
    assert sorted(outcomes) == ["confirmed", "waitlisted"], outcomes

    with FACTORY() as session:
        statuses = session.scalars(
            select(Registration.status).where(Registration.id.in_(registration_ids))
        ).all()
        assert statuses.count(RegistrationStatus.CONFIRMED.value) == 1, statuses
        assert statuses.count(RegistrationStatus.WAITLISTED.value) == 1, statuses
        event = session.get(Event, event_id)
        booking = session.scalar(
            select(VenueBookingRequest).where(VenueBookingRequest.event_id == event_id)
        )
        assert event is not None and booking is not None
        assert event.status == EventStatus.FULL.value, event.status
        assert booking.expected_guests == 2, booking.expected_guests


def _system(session) -> GameSystem:
    system = session.scalar(select(GameSystem).where(GameSystem.slug == "dnd-5e-2014"))
    assert system is not None
    return system


def _user(label: str) -> User:
    token = uuid4().hex[:8]
    return User(
        auth_provider_user_id=f"formation-contract-{label}-{token}",
        email=f"formation-contract-{label}-{token}@example.test",
        status=AccountStatus.ACTIVE.value,
    )


def _gm(session, label: str) -> tuple[User, GMProfile]:
    user = _user(f"gm-{label}")
    session.add(user)
    session.flush()
    session.add(UserRole(user_id=user.id, role=UserRoleType.GM.value))
    profile = GMProfile(
        user_id=user.id,
        postal_code="29501",
        travel_radius_miles=25,
        gm_style="Concurrency contract GM.",
    )
    session.add(profile)
    session.flush()
    return user, profile


def _venue_window(session, label: str, *, table_count: int):
    token = uuid4().hex[:8]
    venue = Venue(
        name=f"Concurrency {label} Venue {token}",
        slug=f"concurrency-{label}-{token}",
        venue_type="cafe",
        address_line1="123 Contract Way",
        city="Florence",
        state_region="SC",
        postal_code="29501",
        latitude=34.1954,
        longitude=-79.7626,
        verified=True,
    )
    rule = RecurringAvailabilityRule(
        day_of_week="friday",
        start_time=START.time().replace(tzinfo=None),
        end_time=END.time().replace(tzinfo=None),
        pattern_type="weekly_interval",
        week_interval=1,
        timezone="America/New_York",
    )
    session.add_all([venue, rule])
    session.flush()
    window = VenueTableWindow(
        venue_id=venue.id,
        recurring_rule_id=rule.id,
        table_count=table_count,
        max_people_per_table=6,
        approval_required=True,
    )
    session.add(window)
    session.flush()
    return venue, window


def _event(*, system, gm_profile, venue, slug: str, max_players: int) -> Event:
    return Event(
        slug=slug,
        title="Concurrency Contract Event",
        gm_profile_id=gm_profile.id,
        game_system_id=system.id,
        venue_id=venue.id,
        event_type="one_shot",
        join_mode="request",
        status=EventStatus.VENUE_REQUESTED.value,
        starts_at=START,
        ends_at=END,
        min_players=1,
        max_players=max_players,
    )


if __name__ == "__main__":
    main()
