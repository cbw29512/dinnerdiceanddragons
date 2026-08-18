"""Shared SQLite fixtures for production table-formation persistence tests."""

from dataclasses import dataclass
from datetime import UTC, datetime, time

from sqlalchemy import Engine, create_engine, event
from sqlalchemy.orm import Session

from app.models.event import Event
from app.models.game_series import GameSeries
from app.models.game_system import GameSystem
from app.models.gm_profile import GMProfile
from app.models.gm_supply_signal import GMSupplySignal
from app.models.player_demand_signal import PlayerDemandSignal
from app.models.player_profile import PlayerProfile
from app.models.recurring_availability_rule import RecurringAvailabilityRule
from app.models.registration import Registration
from app.models.table_expectations import TableExpectations
from app.models.table_match import TableMatch
from app.models.table_match_player import TableMatchPlayer
from app.models.user import AccountStatus, User
from app.models.user_role import UserRole, UserRoleType
from app.models.venue import Venue, VenueManager
from app.models.venue_booking_request import VenueBookingRequest
from app.models.venue_table_window import VenueTableWindow


@dataclass(frozen=True, slots=True)
class FormationSeed:
    """Parent state required to persist and authorize one formed Event."""

    gm_user: User
    player_user: User
    venue_manager_user: User
    gm_profile: GMProfile
    gm_supply: GMSupplySignal
    player_profile: PlayerProfile
    player_demand: PlayerDemandSignal
    system: GameSystem
    venue: Venue
    venue_window: VenueTableWindow
    table_match: TableMatch


def create_formation_session() -> tuple[Session, Engine]:
    """Create in-memory SQLite with production foreign-key behavior enabled."""

    engine = create_engine("sqlite+pysqlite:///:memory:")

    @event.listens_for(engine, "connect")
    def enable_foreign_keys(dbapi_connection: object, _: object) -> None:
        cursor = dbapi_connection.cursor()  # type: ignore[attr-defined]
        try:
            cursor.execute("PRAGMA foreign_keys=ON")
        finally:
            cursor.close()

    for table in (
        User.__table__,
        UserRole.__table__,
        PlayerProfile.__table__,
        GMProfile.__table__,
        Venue.__table__,
        VenueManager.__table__,
        GameSystem.__table__,
        RecurringAvailabilityRule.__table__,
        PlayerDemandSignal.__table__,
        GMSupplySignal.__table__,
        VenueTableWindow.__table__,
        TableMatch.__table__,
        TableMatchPlayer.__table__,
        GameSeries.__table__,
        Event.__table__,
        TableExpectations.__table__,
        Registration.__table__,
        VenueBookingRequest.__table__,
    ):
        table.create(engine)

    return Session(engine), engine


def seed_formation_parents(session: Session) -> FormationSeed:
    """Persist one compatible GM, Player, verified Venue Manager, and TableMatch."""

    gm_user = _user("formation-gm", "formation-gm@example.test")
    player_user = _user("formation-player", "formation-player@example.test")
    venue_manager_user = _user("formation-venue", "formation-venue@example.test")
    system = GameSystem(name="D&D", edition="5e 2024", slug="dnd-5e-2024")
    venue = Venue(
        name="Formation Test Cafe",
        slug="formation-test-cafe",
        venue_type="cafe",
        address_line1="123 Table Way",
        city="Florence",
        state_region="SC",
        postal_code="29501",
        latitude=34.1954,
        longitude=-79.7626,
        verified=True,
    )
    session.add_all([gm_user, player_user, venue_manager_user, system, venue])
    session.flush()
    session.add_all(
        [
            UserRole(user_id=gm_user.id, role=UserRoleType.GM.value),
            UserRole(user_id=player_user.id, role=UserRoleType.PLAYER.value),
            UserRole(user_id=venue_manager_user.id, role=UserRoleType.VENUE_MANAGER.value),
            VenueManager(
                venue_id=venue.id,
                user_id=venue_manager_user.id,
                role="manager",
                verified_at=datetime.now(UTC),
            ),
        ]
    )

    gm_profile = GMProfile(
        user_id=gm_user.id,
        postal_code="29501",
        travel_radius_miles=25,
        gm_style="Collaborative table.",
    )
    player_profile = PlayerProfile(
        user_id=player_user.id,
        postal_code="29501",
        travel_radius_miles=25,
    )
    rule = RecurringAvailabilityRule(
        day_of_week="friday",
        start_time=time(18, 0),
        end_time=time(22, 0),
        pattern_type="weekly_interval",
        week_interval=1,
        timezone="America/New_York",
    )
    session.add_all([gm_profile, player_profile, rule])
    session.flush()

    player_demand = PlayerDemandSignal(
        player_profile_id=player_profile.id,
        game_system_id=system.id,
        preferred_format="one_shot",
    )
    gm_supply = GMSupplySignal(
        gm_profile_id=gm_profile.id,
        game_system_id=system.id,
        preferred_format="one_shot",
        minimum_players=1,
        maximum_players=5,
    )
    venue_window = VenueTableWindow(
        venue_id=venue.id,
        recurring_rule_id=rule.id,
        table_count=2,
        max_people_per_table=6,
        approval_required=True,
    )
    session.add_all([player_demand, gm_supply, venue_window])
    session.flush()

    table_match = TableMatch(
        gm_supply_signal_id=gm_supply.id,
        venue_table_window_id=venue_window.id,
        game_system_id=system.id,
        proposed_start=datetime(2026, 8, 21, 22, 0, tzinfo=UTC),
        proposed_end=datetime(2026, 8, 22, 2, 0, tzinfo=UTC),
        timezone="America/New_York",
        minimum_players=1,
        maximum_players=5,
        compatible_player_count=1,
    )
    session.add(table_match)
    session.flush()
    _add_table_match_player(session, table_match, player_demand)
    session.commit()

    return FormationSeed(
        gm_user=gm_user,
        player_user=player_user,
        venue_manager_user=venue_manager_user,
        gm_profile=gm_profile,
        gm_supply=gm_supply,
        player_profile=player_profile,
        player_demand=player_demand,
        system=system,
        venue=venue,
        venue_window=venue_window,
        table_match=table_match,
    )


def add_eligible_player(
    session: Session,
    seed: FormationSeed,
    *,
    suffix: str,
) -> tuple[User, PlayerProfile]:
    """Add another active Player who was eligible on the seed TableMatch."""

    user = _user(f"formation-player-{suffix}", f"formation-player-{suffix}@example.test")
    session.add(user)
    session.flush()
    session.add(UserRole(user_id=user.id, role=UserRoleType.PLAYER.value))
    profile = PlayerProfile(
        user_id=user.id,
        postal_code="29501",
        travel_radius_miles=25,
    )
    session.add(profile)
    session.flush()
    demand = PlayerDemandSignal(
        player_profile_id=profile.id,
        game_system_id=seed.system.id,
        preferred_format="one_shot",
    )
    session.add(demand)
    session.flush()
    _add_table_match_player(session, seed.table_match, demand)
    seed.table_match.compatible_player_count += 1
    session.commit()
    return user, profile


def _add_table_match_player(
    session: Session,
    table_match: TableMatch,
    demand: PlayerDemandSignal,
) -> None:
    session.add(
        TableMatchPlayer(
            table_match_id=table_match.id,
            player_demand_signal_id=demand.id,
            fit_flags=["system", "schedule", "distance"],
            distance_miles=0,
            availability_overlap={
                "start": table_match.proposed_start.isoformat(),
                "end": table_match.proposed_end.isoformat(),
            },
        )
    )


def _user(subject: str, email: str) -> User:
    return User(
        auth_provider_user_id=subject,
        email=email,
        status=AccountStatus.ACTIVE.value,
    )
