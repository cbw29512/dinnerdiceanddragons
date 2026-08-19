"""Reusable persisted fixtures for Table Match runner integration tests."""

from datetime import time

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.models.availability_window import GMAvailabilityWindow, PlayerAvailabilityWindow
from app.models.game_system import GameSystem
from app.models.game_table import GameTable
from app.models.game_table_player import GameTablePlayer
from app.models.gm_profile import GMProfile
from app.models.gm_supply_signal import GMSupplySignal
from app.models.match_explanation import MatchExplanation
from app.models.matching_signal_availability import (
    GMSupplyAvailabilityWindow,
    PlayerDemandAvailabilityWindow,
)
from app.models.player_demand_signal import PlayerDemandSignal
from app.models.player_profile import PlayerProfile
from app.models.recurring_availability_rule import RecurringAvailabilityRule
from app.models.table_match import TableMatch
from app.models.table_match_player import TableMatchPlayer
from app.models.user import AccountStatus, User
from app.models.user_role import UserRole, UserRoleType
from app.models.venue import Venue
from app.models.venue_table_window import VenueTableWindow


def build_runner_factory(
    *,
    player_count: int = 3,
    gm_minimum_players: int = 3,
    venue_verified: bool = True,
) -> sessionmaker[Session]:
    """Create one shared in-memory DB containing a matchable Friday table."""

    engine = create_engine("sqlite+pysqlite:///:memory:", poolclass=StaticPool)
    for table in (
        User.__table__,
        UserRole.__table__,
        PlayerProfile.__table__,
        GMProfile.__table__,
        Venue.__table__,
        GameSystem.__table__,
        RecurringAvailabilityRule.__table__,
        PlayerAvailabilityWindow.__table__,
        GMAvailabilityWindow.__table__,
        PlayerDemandSignal.__table__,
        GMSupplySignal.__table__,
        PlayerDemandAvailabilityWindow.__table__,
        GMSupplyAvailabilityWindow.__table__,
        VenueTableWindow.__table__,
        TableMatch.__table__,
        GameTable.__table__,
        GameTablePlayer.__table__,
        TableMatchPlayer.__table__,
        MatchExplanation.__table__,
    ):
        table.create(engine)

    factory = sessionmaker(bind=engine, class_=Session, expire_on_commit=False)
    with factory() as session:
        _seed_runner_data(
            session,
            player_count=player_count,
            gm_minimum_players=gm_minimum_players,
            venue_verified=venue_verified,
        )
        session.commit()
    return factory


def _seed_runner_data(
    session: Session,
    *,
    player_count: int,
    gm_minimum_players: int,
    venue_verified: bool,
) -> None:
    system = GameSystem(name="D&D", edition="5e 2024", slug="dnd-5e-2024")
    gm_user = _user("gm", "gm@example.test")
    venue = Venue(
        name="Runner Test Cafe",
        slug="runner-test-cafe",
        venue_type="cafe",
        address_line1="123 Table Way",
        city="Florence",
        state_region="SC",
        postal_code="29501",
        latitude=34.1954,
        longitude=-79.7626,
        verified=venue_verified,
    )
    session.add_all([system, gm_user, venue])
    session.flush()
    session.add(UserRole(user_id=gm_user.id, role=UserRoleType.GM.value))

    gm_profile = GMProfile(
        user_id=gm_user.id,
        postal_code="29501",
        travel_radius_miles=25,
        gm_style="Collaborative table.",
    )
    gm_rule = _friday_rule()
    venue_rule = _friday_rule()
    session.add_all([gm_profile, gm_rule, venue_rule])
    session.flush()
    session.add_all(
        [
            GMAvailabilityWindow(
                gm_profile_id=gm_profile.id,
                recurring_rule_id=gm_rule.id,
            ),
            GMSupplySignal(
                gm_profile_id=gm_profile.id,
                game_system_id=system.id,
                preferred_format="one_shot",
                minimum_players=gm_minimum_players,
                maximum_players=5,
            ),
            VenueTableWindow(
                venue_id=venue.id,
                recurring_rule_id=venue_rule.id,
                table_count=2,
                max_people_per_table=6,
                approval_required=True,
            ),
        ]
    )

    for index in range(player_count):
        user = _user(f"player-{index}", f"player-{index}@example.test")
        session.add(user)
        session.flush()
        session.add(UserRole(user_id=user.id, role=UserRoleType.PLAYER.value))
        profile = PlayerProfile(
            user_id=user.id,
            postal_code="29501",
            travel_radius_miles=25,
        )
        rule = _friday_rule()
        session.add_all([profile, rule])
        session.flush()
        session.add_all(
            [
                PlayerAvailabilityWindow(
                    player_profile_id=profile.id,
                    recurring_rule_id=rule.id,
                ),
                PlayerDemandSignal(
                    player_profile_id=profile.id,
                    game_system_id=system.id,
                    preferred_format="one_shot",
                ),
            ]
        )


def _user(subject: str, email: str) -> User:
    return User(
        auth_provider_user_id=f"runner-{subject}",
        email=email,
        status=AccountStatus.ACTIVE.value,
    )


def _friday_rule() -> RecurringAvailabilityRule:
    return RecurringAvailabilityRule(
        day_of_week="friday",
        start_time=time(18, 0),
        end_time=time(22, 0),
        pattern_type="weekly_interval",
        week_interval=1,
        timezone="America/New_York",
    )
