"""Persisted fixtures for authenticated Table Match opportunity API tests."""

from datetime import UTC, datetime, time
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from app.models.game_system import GameSystem
from app.models.gm_profile import GMProfile
from app.models.gm_supply_signal import GMSupplySignal
from app.models.match_explanation import MatchExplanation
from app.models.player_demand_signal import PlayerDemandSignal
from app.models.player_profile import PlayerProfile
from app.models.recurring_availability_rule import RecurringAvailabilityRule
from app.models.table_match import TableMatch
from app.models.table_match_player import TableMatchPlayer
from app.models.user import User
from app.models.user_role import UserRole, UserRoleType
from app.models.venue import Venue, VenueManager
from app.models.venue_table_window import VenueTableWindow


def seed_api_matches(factory: sessionmaker[Session]) -> tuple[UUID, UUID, UUID, UUID]:
    """Create one shared Alice/Bob match and one Bob-only match."""

    with factory() as session:
        alice = session.scalar(select(User).where(User.email == "alice@example.com"))
        bob = session.scalar(select(User).where(User.email == "bob@example.com"))
        system = session.scalar(select(GameSystem).where(GameSystem.slug == "dnd-5e-2014"))
        assert alice is not None and bob is not None and system is not None

        session.add_all(
            [
                UserRole(user_id=alice.id, role=UserRoleType.PLAYER.value),
                UserRole(user_id=bob.id, role=UserRoleType.GM.value),
                UserRole(user_id=bob.id, role=UserRoleType.VENUE_MANAGER.value),
            ]
        )
        player = PlayerProfile(user_id=alice.id, postal_code="29501", travel_radius_miles=25)
        gm = GMProfile(
            user_id=bob.id,
            postal_code="29501",
            travel_radius_miles=25,
            gm_style="Collaborative table.",
        )
        session.add_all([player, gm])
        session.flush()

        demand = PlayerDemandSignal(
            player_profile_id=player.id,
            game_system_id=system.id,
            preferred_format="one_shot",
        )
        supply = GMSupplySignal(
            gm_profile_id=gm.id,
            game_system_id=system.id,
            preferred_format="one_shot",
            minimum_players=1,
            maximum_players=5,
        )
        session.add_all([demand, supply])
        session.flush()

        shared = _seed_venue_match(
            session,
            system=system,
            supply=supply,
            name="Shared Table Cafe",
            slug="shared-table-cafe",
            start_hour=18,
        )
        bob_only = _seed_venue_match(
            session,
            system=system,
            supply=supply,
            name="Second Table Cafe",
            slug="second-table-cafe",
            start_hour=20,
        )

        session.add(
            TableMatchPlayer(
                table_match_id=shared.id,
                player_demand_signal_id=demand.id,
                fit_flags=["system", "schedule", "distance"],
                distance_miles=Decimal("5.25"),
                availability_overlap={
                    "start": "2026-08-21T18:00:00-04:00",
                    "end": "2026-08-21T22:00:00-04:00",
                },
            )
        )
        session.add(
            MatchExplanation(
                table_match_id=shared.id,
                criterion="system",
                result="pass",
                summary="Player and GM selected the same canonical game system and edition.",
            )
        )
        session.commit()
        return shared.id, bob_only.id, alice.id, bob.id


def _seed_venue_match(
    session: Session,
    *,
    system: GameSystem,
    supply: GMSupplySignal,
    name: str,
    slug: str,
    start_hour: int,
) -> TableMatch:
    venue = Venue(
        name=name,
        slug=slug,
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
        start_time=time(start_hour, 0),
        end_time=time(23, 0),
        pattern_type="weekly_interval",
        week_interval=1,
        timezone="America/New_York",
    )
    session.add_all([venue, rule])
    session.flush()
    manager_user_id = session.scalar(
        select(GMProfile.user_id).where(GMProfile.id == supply.gm_profile_id)
    )
    assert manager_user_id is not None
    session.add(
        VenueManager(
            venue_id=venue.id,
            user_id=manager_user_id,
            role="manager",
            verified_at=datetime.now(UTC),
        )
    )
    window = VenueTableWindow(
        venue_id=venue.id,
        recurring_rule_id=rule.id,
        table_count=2,
        max_people_per_table=6,
        approval_required=True,
    )
    session.add(window)
    session.flush()
    match = TableMatch(
        gm_supply_signal_id=supply.id,
        venue_table_window_id=window.id,
        game_system_id=system.id,
        proposed_start=datetime(2026, 8, 21, start_hour, 0, tzinfo=UTC),
        proposed_end=datetime(2026, 8, 21, 23, 0, tzinfo=UTC),
        timezone="America/New_York",
        minimum_players=1,
        maximum_players=5,
        compatible_player_count=1,
        distance_summary={"gm_miles": 7.5},
    )
    session.add(match)
    session.flush()
    return match
