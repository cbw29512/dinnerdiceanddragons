"""Reusable SQLite fixture for seat, headcount, and waitlist tests."""

from dataclasses import dataclass
from datetime import UTC, datetime, time

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

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
from app.models.venue import Venue
from app.models.venue_booking_request import VenueBookingRequest
from app.models.venue_table_window import VenueTableWindow


@dataclass(frozen=True, slots=True)
class LifecycleSeed:
    event_id: object
    booking_id: object
    player_users: tuple[User, ...]


def build_lifecycle_factory(*, player_count: int = 2) -> tuple[sessionmaker[Session], LifecycleSeed]:
    engine = create_engine("sqlite+pysqlite:///:memory:", poolclass=StaticPool)
    for table in (
        User.__table__,
        PlayerProfile.__table__,
        GMProfile.__table__,
        Venue.__table__,
        GameSystem.__table__,
        RecurringAvailabilityRule.__table__,
        PlayerDemandSignal.__table__,
        GMSupplySignal.__table__,
        VenueTableWindow.__table__,
        TableMatch.__table__,
        TableMatchPlayer.__table__,
        Event.__table__,
        Registration.__table__,
        VenueBookingRequest.__table__,
    ):
        table.create(engine)
    factory = sessionmaker(bind=engine, class_=Session, expire_on_commit=False)
    with factory() as session:
        seed = _seed(session, player_count)
        session.commit()
    return factory, seed


def _seed(session: Session, player_count: int) -> LifecycleSeed:
    system = GameSystem(name="D&D", edition="5e 2024", slug="dnd-5e-2024")
    gm_user = _user("gm")
    venue = Venue(
        name="Lifecycle Cafe",
        slug="lifecycle-cafe",
        venue_type="cafe",
        address_line1="123 Public Way",
        city="Florence",
        state_region="SC",
        postal_code="29501",
        latitude=34.1954,
        longitude=-79.7626,
        verified=True,
    )
    rule = RecurringAvailabilityRule(
        day_of_week="friday",
        start_time=time(18),
        end_time=time(22),
        pattern_type="weekly_interval",
        week_interval=1,
        timezone="America/New_York",
    )
    session.add_all([system, gm_user, venue, rule])
    session.flush()
    gm = GMProfile(
        user_id=gm_user.id,
        postal_code="29501",
        travel_radius_miles=25,
        gm_style="Collaborative.",
    )
    session.add(gm)
    session.flush()
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
        approval_required=False,
    )
    session.add_all([supply, window])
    session.flush()
    match = TableMatch(
        gm_supply_signal_id=supply.id,
        venue_table_window_id=window.id,
        game_system_id=system.id,
        proposed_start=datetime(2026, 8, 21, 22, tzinfo=UTC),
        proposed_end=datetime(2026, 8, 22, 2, tzinfo=UTC),
        timezone="America/New_York",
        minimum_players=1,
        maximum_players=1,
        compatible_player_count=player_count,
    )
    session.add(match)
    session.flush()

    player_users: list[User] = []
    for index in range(player_count):
        user = _user(f"player-{index}")
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
        session.add(
            TableMatchPlayer(
                table_match_id=match.id,
                player_demand_signal_id=demand.id,
                distance_miles=5,
            )
        )
        player_users.append(user)

    event = Event(
        table_match_id=match.id,
        slug="lifecycle-event",
        title="Lifecycle Event",
        description="Lifecycle test.",
        gm_profile_id=gm.id,
        game_system_id=system.id,
        venue_id=venue.id,
        event_type="one_shot",
        join_mode="instant_join",
        status="forming",
        starts_at=match.proposed_start,
        ends_at=match.proposed_end,
        min_players=1,
        max_players=1,
    )
    session.add(event)
    session.flush()
    booking = VenueBookingRequest(
        venue_table_window_id=window.id,
        gm_profile_id=gm.id,
        table_match_id=match.id,
        event_id=event.id,
        requested_start=event.starts_at,
        requested_end=event.ends_at,
        tables_requested=1,
        expected_guests=1,
        status="approved",
    )
    session.add(booking)
    session.flush()
    return LifecycleSeed(event_id=event.id, booking_id=booking.id, player_users=tuple(player_users))


def _user(name: str) -> User:
    return User(
        auth_provider_user_id=f"lifecycle-{name}",
        email=f"lifecycle-{name}@example.test",
        status=AccountStatus.ACTIVE.value,
    )
