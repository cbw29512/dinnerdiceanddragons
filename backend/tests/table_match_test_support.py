"""Shared SQLite setup and seed data for Table Match persistence tests."""

from dataclasses import dataclass
from datetime import time

from sqlalchemy import Engine, create_engine, event
from sqlalchemy.orm import Session

from app.models.game_system import GameSystem
from app.models.gm_profile import GMProfile
from app.models.gm_supply_signal import GMSupplySignal
from app.models.match_explanation import MatchExplanation
from app.models.player_demand_signal import PlayerDemandSignal
from app.models.player_profile import PlayerProfile
from app.models.recurring_availability_rule import RecurringAvailabilityRule
from app.models.table_match import TableMatch
from app.models.table_match_player import TableMatchPlayer
from app.models.user import AccountStatus, User
from app.models.venue import Venue
from app.models.venue_table_window import VenueTableWindow


@dataclass(frozen=True, slots=True)
class MatchSeed:
    """Persisted parent records required to create one Table Match."""

    system: GameSystem
    player_demand: PlayerDemandSignal
    gm_supply: GMSupplySignal
    venue_window: VenueTableWindow


def create_table_match_session() -> tuple[Session, Engine]:
    """Return an in-memory SQLite session with production FK checks enabled."""

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
        MatchExplanation.__table__,
    ):
        table.create(engine)

    return Session(engine), engine


def seed_match_inputs(session: Session) -> MatchSeed:
    """Persist one compatible Player, GM, Venue, system, and Venue window."""

    user = User(
        auth_provider_user_id="table-match-user",
        email="table-match@example.com",
        status=AccountStatus.ACTIVE.value,
    )
    system = GameSystem(name="Pathfinder", edition="2e", slug="pathfinder-2e")
    venue = Venue(
        name="Florence Table Cafe",
        slug="florence-table-cafe",
        venue_type="cafe",
        address_line1="123 Table Way",
        city="Florence",
        state_region="SC",
        postal_code="29501",
        verified=True,
    )
    session.add_all([user, system, venue])
    session.flush()

    player_profile = PlayerProfile(
        user_id=user.id,
        postal_code="29501",
        travel_radius_miles=25,
    )
    gm_profile = GMProfile(
        user_id=user.id,
        postal_code="29501",
        travel_radius_miles=25,
        beginner_friendly=True,
        gm_style="Collaborative rules-forward table.",
    )
    rule = RecurringAvailabilityRule(
        day_of_week="friday",
        start_time=time(18, 0),
        end_time=time(22, 0),
        pattern_type="weekly_interval",
        week_interval=1,
        timezone="America/New_York",
    )
    session.add_all([player_profile, gm_profile, rule])
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
        minimum_players=3,
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
    session.commit()

    return MatchSeed(
        system=system,
        player_demand=player_demand,
        gm_supply=gm_supply,
        venue_window=venue_window,
    )
