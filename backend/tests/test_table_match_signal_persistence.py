"""Persistence and invariant tests for the three production Table Match inputs."""

from datetime import time

import pytest
from sqlalchemy import create_engine, event, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.game_system import GameSystem
from app.models.gm_profile import GMProfile
from app.models.gm_supply_signal import GMSupplySignal
from app.models.player_demand_signal import PlayerDemandSignal
from app.models.player_profile import PlayerProfile
from app.models.recurring_availability_rule import RecurringAvailabilityRule
from app.models.user import AccountStatus, User
from app.models.venue import Venue
from app.models.venue_table_window import VenueTableWindow


@pytest.fixture()
def session() -> Session:
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
    ):
        table.create(engine)

    db = Session(engine)
    try:
        yield db
    finally:
        db.close()
        engine.dispose()


def seed_match_inputs(session: Session):
    user = User(
        auth_provider_user_id="step3-user",
        email="step3@example.com",
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
    )
    session.add_all([user, system, venue])
    session.flush()

    player = PlayerProfile(user_id=user.id, postal_code="29501", travel_radius_miles=25)
    gm = GMProfile(
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
    session.add_all([player, gm, rule])
    session.flush()
    return player, gm, venue, system, rule


def test_three_sided_match_inputs_persist_together(session: Session) -> None:
    player, gm, venue, system, rule = seed_match_inputs(session)
    session.add_all(
        [
            PlayerDemandSignal(
                player_profile_id=player.id,
                game_system_id=system.id,
                preferred_format="one_shot",
                preferred_cadence="monthly",
                minimum_age_preference=18,
                table_style_preferences=["roleplay-forward"],
                environment_preferences=["quieter venue"],
            ),
            GMSupplySignal(
                gm_profile_id=gm.id,
                game_system_id=system.id,
                preferred_format="one_shot",
                preferred_cadence="monthly",
                minimum_players=3,
                maximum_players=5,
                table_style="Collaborative",
            ),
            VenueTableWindow(
                venue_id=venue.id,
                recurring_rule_id=rule.id,
                table_count=2,
                max_people_per_table=6,
                purchase_policy="One purchase per guest.",
                approval_required=True,
            ),
        ]
    )
    session.commit()

    assert session.scalar(select(PlayerDemandSignal)) is not None
    assert session.scalar(select(GMSupplySignal)) is not None
    venue_window = session.scalar(select(VenueTableWindow))
    assert venue_window is not None
    assert venue_window.max_people_per_table == 6


def test_gm_supply_rejects_impossible_player_range(session: Session) -> None:
    _, gm, _, system, _ = seed_match_inputs(session)
    session.add(
        GMSupplySignal(
            gm_profile_id=gm.id,
            game_system_id=system.id,
            preferred_format="one_shot",
            minimum_players=5,
            maximum_players=3,
        )
    )

    with pytest.raises(IntegrityError):
        session.commit()
    session.rollback()


def test_venue_recurrence_rule_has_one_typed_venue_owner(session: Session) -> None:
    _, _, venue, _, rule = seed_match_inputs(session)
    session.add_all(
        [
            VenueTableWindow(
                venue_id=venue.id,
                recurring_rule_id=rule.id,
                table_count=1,
                max_people_per_table=6,
                approval_required=True,
            ),
            VenueTableWindow(
                venue_id=venue.id,
                recurring_rule_id=rule.id,
                table_count=1,
                max_people_per_table=4,
                approval_required=False,
            ),
        ]
    )

    with pytest.raises(IntegrityError):
        session.commit()
    session.rollback()


def test_player_profile_delete_cascades_demand_signal(session: Session) -> None:
    player, _, _, system, _ = seed_match_inputs(session)
    signal = PlayerDemandSignal(
        player_profile_id=player.id,
        game_system_id=system.id,
        preferred_format="any",
    )
    session.add(signal)
    session.commit()

    session.delete(player)
    session.commit()

    assert session.scalar(select(PlayerDemandSignal)) is None
