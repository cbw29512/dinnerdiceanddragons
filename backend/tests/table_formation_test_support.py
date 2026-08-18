"""Shared SQLite setup for production table-formation tests."""

from dataclasses import dataclass
from datetime import UTC, datetime, time

from sqlalchemy import Engine, create_engine, event
from sqlalchemy.orm import Session

from app.models.event import Event
from app.models.game_series import GameSeries
from app.models.game_system import GameSystem
from app.models.gm_profile import GMProfile
from app.models.gm_supply_signal import GMSupplySignal
from app.models.player_profile import PlayerProfile
from app.models.recurring_availability_rule import RecurringAvailabilityRule
from app.models.registration import Registration
from app.models.table_expectations import TableExpectations
from app.models.table_match import TableMatch
from app.models.user import AccountStatus, User
from app.models.venue import Venue
from app.models.venue_booking_request import VenueBookingRequest
from app.models.venue_table_window import VenueTableWindow


@dataclass(frozen=True, slots=True)
class FormationSeed:
    gm: GMProfile
    player: PlayerProfile
    venue: Venue
    system: GameSystem
    window: VenueTableWindow
    match: TableMatch


def create_formation_session() -> tuple[Session, Engine]:
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
        GMSupplySignal.__table__,
        VenueTableWindow.__table__,
        TableMatch.__table__,
        GameSeries.__table__,
        Event.__table__,
        TableExpectations.__table__,
        Registration.__table__,
        VenueBookingRequest.__table__,
    ):
        table.create(engine)

    return Session(engine), engine


def seed_formation_inputs(session: Session) -> FormationSeed:
    gm_user = User(
        auth_provider_user_id="formation-gm",
        email="formation-gm@example.test",
        status=AccountStatus.ACTIVE.value,
    )
    player_user = User(
        auth_provider_user_id="formation-player",
        email="formation-player@example.test",
        status=AccountStatus.ACTIVE.value,
    )
    system = GameSystem(name="Pathfinder", edition="2e", slug="pathfinder-2e")
    venue = Venue(
        name="Formation Cafe",
        slug="formation-cafe",
        venue_type="cafe",
        address_line1="123 Public Way",
        city="Florence",
        state_region="SC",
        postal_code="29501",
        latitude=34.1954,
        longitude=-79.7626,
        verified=True,
    )
    session.add_all([gm_user, player_user, system, venue])
    session.flush()

    gm = GMProfile(
        user_id=gm_user.id,
        postal_code="29501",
        travel_radius_miles=25,
        gm_style="Collaborative table.",
    )
    player = PlayerProfile(
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
    session.add_all([gm, player, rule])
    session.flush()

    supply = GMSupplySignal(
        gm_profile_id=gm.id,
        game_system_id=system.id,
        preferred_format="one_shot",
        minimum_players=3,
        maximum_players=5,
    )
    window = VenueTableWindow(
        venue_id=venue.id,
        recurring_rule_id=rule.id,
        table_count=2,
        max_people_per_table=6,
        approval_required=True,
    )
    session.add_all([supply, window])
    session.flush()

    match = TableMatch(
        gm_supply_signal_id=supply.id,
        venue_table_window_id=window.id,
        game_system_id=system.id,
        proposed_start=datetime(2026, 8, 21, 22, 0, tzinfo=UTC),
        proposed_end=datetime(2026, 8, 22, 2, 0, tzinfo=UTC),
        timezone="America/New_York",
        minimum_players=3,
        maximum_players=5,
        compatible_player_count=3,
    )
    session.add(match)
    session.commit()
    return FormationSeed(
        gm=gm,
        player=player,
        venue=venue,
        system=system,
        window=window,
        match=match,
    )
