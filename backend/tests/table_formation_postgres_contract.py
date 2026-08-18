"""Executable PostgreSQL concurrency contract for production table formation."""

from dataclasses import dataclass
from datetime import UTC, datetime, time
from threading import Barrier, Lock, Thread
from uuid import UUID

from sqlalchemy import select

from app.db.session import get_session_factory
from app.models.event import Event
from app.models.game_system import GameSystem
from app.models.gm_profile import GMProfile
from app.models.gm_supply_signal import GMSupplySignal
from app.models.player_demand_signal import PlayerDemandSignal
from app.models.player_profile import PlayerProfile
from app.models.recurring_availability_rule import RecurringAvailabilityRule
from app.models.registration import Registration
from app.models.table_match import TableMatch
from app.models.table_match_player import TableMatchPlayer
from app.models.user import AccountStatus, User
from app.models.venue import Venue, VenueManager
from app.models.venue_booking_request import VenueBookingRequest
from app.models.venue_table_window import VenueTableWindow
from app.services.player_registration_service import request_registration
from app.services.venue_booking_capacity import VenueCapacityConflictError
from app.services.venue_booking_service import decide_venue_booking


@dataclass(frozen=True, slots=True)
class ContractSeed:
    seat_event_id: UUID
    seat_booking_id: UUID
    player_user_ids: tuple[UUID, UUID]
    manager_user_id: UUID
    booking_ids: tuple[UUID, UUID]


def main() -> None:
    factory = get_session_factory()
    seed = seed_contract(factory)
    verify_final_seat_serialization(factory, seed)
    verify_venue_approval_serialization(factory, seed)
    print("Table formation PostgreSQL concurrency contract passed.")


def seed_contract(factory) -> ContractSeed:
    with factory() as session:
        system = session.scalar(select(GameSystem).where(GameSystem.slug == "dnd-5e-2014"))
        if system is None:
            raise RuntimeError("Seeded D&D game system is missing.")
        gm_user = _user("formation-contract-gm")
        venue = Venue(
            name="Formation Contract Cafe",
            slug="formation-contract-cafe",
            venue_type="cafe",
            address_line1="123 Contract Way",
            city="Florence",
            state_region="SC",
            postal_code="29501",
            latitude=34.1954,
            longitude=-79.7626,
            verified=True,
        )
        rule = _rule()
        session.add_all([gm_user, venue, rule])
        session.flush()
        gm = GMProfile(
            user_id=gm_user.id,
            postal_code="29501",
            travel_radius_miles=25,
            gm_style="Concurrency contract GM.",
        )
        session.add(gm)
        session.flush()
        session.add(
            VenueManager(
                venue_id=venue.id,
                user_id=gm_user.id,
                role="manager",
                verified_at=datetime.now(UTC),
            )
        )
        supply = GMSupplySignal(
            gm_profile_id=gm.id,
            game_system_id=system.id,
            preferred_format="one_shot",
            minimum_players=1,
            maximum_players=1,
        )
        window = VenueTableWindow(
            venue_id=venue.id,
            recurring_rule_id=rule.id,
            table_count=1,
            max_people_per_table=2,
            approval_required=True,
        )
        session.add_all([supply, window])
        session.flush()

        player_users: list[User] = []
        player_demands: list[PlayerDemandSignal] = []
        for index in range(2):
            user = _user(f"formation-contract-player-{index}")
            session.add(user)
            session.flush()
            profile = PlayerProfile(user_id=user.id, postal_code="29501", travel_radius_miles=25)
            session.add(profile)
            session.flush()
            demand = PlayerDemandSignal(
                player_profile_id=profile.id,
                game_system_id=system.id,
                preferred_format="one_shot",
            )
            session.add(demand)
            session.flush()
            player_users.append(user)
            player_demands.append(demand)

        match = TableMatch(
            gm_supply_signal_id=supply.id,
            venue_table_window_id=window.id,
            game_system_id=system.id,
            proposed_start=datetime(2026, 8, 21, 18, tzinfo=UTC),
            proposed_end=datetime(2026, 8, 21, 20, tzinfo=UTC),
            timezone="UTC",
            minimum_players=1,
            maximum_players=1,
            compatible_player_count=2,
        )
        session.add(match)
        session.flush()
        for demand in player_demands:
            session.add(
                TableMatchPlayer(
                    table_match_id=match.id,
                    player_demand_signal_id=demand.id,
                    distance_miles=5,
                )
            )

        seat_event = _event(
            gm,
            system,
            venue,
            slug="formation-contract-seat",
            starts_at=match.proposed_start,
            ends_at=match.proposed_end,
            table_match_id=match.id,
            join_mode="instant_join",
        )
        session.add(seat_event)
        session.flush()
        seat_booking = _booking(window, gm, seat_event, status="approved")
        session.add(seat_booking)

        race_events = [
            _event(
                gm,
                system,
                venue,
                slug=f"formation-contract-booking-{index}",
                starts_at=datetime(2026, 8, 21, 22, tzinfo=UTC),
                ends_at=datetime(2026, 8, 22, 1, tzinfo=UTC),
                table_match_id=None,
                join_mode="request_to_join",
            )
            for index in range(2)
        ]
        session.add_all(race_events)
        session.flush()
        race_bookings = [_booking(window, gm, event, status="requested") for event in race_events]
        session.add_all(race_bookings)
        session.commit()
        return ContractSeed(
            seat_event_id=seat_event.id,
            seat_booking_id=seat_booking.id,
            player_user_ids=(player_users[0].id, player_users[1].id),
            manager_user_id=gm_user.id,
            booking_ids=(race_bookings[0].id, race_bookings[1].id),
        )


def verify_final_seat_serialization(factory, seed: ContractSeed) -> None:
    barrier = Barrier(2)
    lock = Lock()
    statuses: list[str] = []
    errors: list[BaseException] = []

    def worker(user_id: UUID) -> None:
        try:
            with factory() as session:
                user = session.get(User, user_id)
                if user is None:
                    raise RuntimeError("Player user disappeared.")
                barrier.wait()
                result = request_registration(session, user, seed.seat_event_id)
                with lock:
                    statuses.append(result.status)
        except BaseException as exc:
            with lock:
                errors.append(exc)

    threads = [Thread(target=worker, args=(user_id,)) for user_id in seed.player_user_ids]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=15)
    if errors:
        raise RuntimeError(f"Concurrent seat request failed: {errors!r}")
    if sorted(statuses) != ["confirmed", "waitlisted"]:
        raise RuntimeError(f"Expected one confirmed and one waitlisted seat, got {statuses!r}")

    with factory() as session:
        registrations = session.scalars(
            select(Registration).where(Registration.event_id == seed.seat_event_id)
        ).all()
        confirmed = sum(item.status == "confirmed" for item in registrations)
        booking = session.get(VenueBookingRequest, seed.seat_booking_id)
        event = session.get(Event, seed.seat_event_id)
        if confirmed != 1 or booking is None or booking.expected_guests != 2:
            raise RuntimeError("Final-seat transaction overbooked or miscounted headcount.")
        if event is None or event.status != "full":
            raise RuntimeError("Final-seat transaction did not mark Event full.")


def verify_venue_approval_serialization(factory, seed: ContractSeed) -> None:
    barrier = Barrier(2)
    lock = Lock()
    outcomes: list[str] = []
    errors: list[BaseException] = []

    def worker(booking_id: UUID) -> None:
        try:
            with factory() as session:
                user = session.get(User, seed.manager_user_id)
                if user is None:
                    raise RuntimeError("Venue Manager disappeared.")
                barrier.wait()
                try:
                    decide_venue_booking(session, user, booking_id, "approve", None)
                    outcome = "approved"
                except VenueCapacityConflictError:
                    outcome = "capacity_conflict"
                with lock:
                    outcomes.append(outcome)
        except BaseException as exc:
            with lock:
                errors.append(exc)

    threads = [Thread(target=worker, args=(booking_id,)) for booking_id in seed.booking_ids]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=15)
    if errors:
        raise RuntimeError(f"Concurrent Venue approval failed: {errors!r}")
    if sorted(outcomes) != ["approved", "capacity_conflict"]:
        raise RuntimeError(f"Expected one approval and one capacity conflict, got {outcomes!r}")

    with factory() as session:
        statuses = [session.get(VenueBookingRequest, booking_id).status for booking_id in seed.booking_ids]
        if statuses.count("approved") != 1:
            raise RuntimeError(f"Venue capacity race approved {statuses.count('approved')} bookings.")


def _user(name: str) -> User:
    return User(
        auth_provider_user_id=name,
        email=f"{name}@example.test",
        status=AccountStatus.ACTIVE.value,
    )


def _rule() -> RecurringAvailabilityRule:
    return RecurringAvailabilityRule(
        day_of_week="friday",
        start_time=time(18),
        end_time=time(23),
        pattern_type="weekly_interval",
        week_interval=1,
        timezone="UTC",
    )


def _event(
    gm: GMProfile,
    system: GameSystem,
    venue: Venue,
    *,
    slug: str,
    starts_at: datetime,
    ends_at: datetime,
    table_match_id: UUID | None,
    join_mode: str,
) -> Event:
    return Event(
        table_match_id=table_match_id,
        slug=slug,
        title=slug.replace("-", " ").title(),
        description="PostgreSQL concurrency contract.",
        gm_profile_id=gm.id,
        game_system_id=system.id,
        venue_id=venue.id,
        event_type="one_shot",
        join_mode=join_mode,
        status="forming",
        starts_at=starts_at,
        ends_at=ends_at,
        min_players=1,
        max_players=1,
    )


def _booking(
    window: VenueTableWindow,
    gm: GMProfile,
    event: Event,
    *,
    status: str,
) -> VenueBookingRequest:
    return VenueBookingRequest(
        venue_table_window_id=window.id,
        gm_profile_id=gm.id,
        event_id=event.id,
        requested_start=event.starts_at,
        requested_end=event.ends_at,
        tables_requested=1,
        expected_guests=1,
        status=status,
    )


if __name__ == "__main__":
    main()
