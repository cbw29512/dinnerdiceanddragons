"""Persisted fixture for authenticated table-formation lifecycle API tests."""

from datetime import UTC, datetime, time

from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from app.models.game_system import GameSystem
from app.models.gm_profile import GMProfile
from app.models.gm_supply_signal import GMSupplySignal
from app.models.player_demand_signal import PlayerDemandSignal
from app.models.player_profile import PlayerProfile
from app.models.recurring_availability_rule import RecurringAvailabilityRule
from app.models.table_match import TableMatch
from app.models.table_match_player import TableMatchPlayer
from app.models.user import User
from app.models.user_role import UserRole, UserRoleType
from app.models.venue import Venue, VenueManager
from app.models.venue_table_window import VenueTableWindow


def seed_formation_api_match(factory: sessionmaker[Session]) -> TableMatch:
    """Create one real matched Player + GM + verified Venue opportunity."""

    with factory() as session:
        alice = session.scalar(select(User).where(User.email == "alice@example.com"))
        bob = session.scalar(select(User).where(User.email == "bob@example.com"))
        system = session.scalar(select(GameSystem).where(GameSystem.slug == "dnd-5e-2014"))
        assert alice is not None and bob is not None and system is not None

        session.add_all(
            [
                UserRole(user_id=alice.id, role=UserRoleType.PLAYER.value),
                UserRole(user_id=alice.id, role=UserRoleType.GM.value),
                UserRole(user_id=alice.id, role=UserRoleType.VENUE_MANAGER.value),
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
        venue = Venue(
            name="Production Formation Cafe",
            slug="production-formation-cafe",
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
            start_time=time(18, 0),
            end_time=time(22, 0),
            pattern_type="weekly_interval",
            week_interval=1,
            timezone="America/New_York",
        )
        session.add_all([player, gm, venue, rule])
        session.flush()
        session.add(
            VenueManager(
                venue_id=venue.id,
                user_id=bob.id,
                role="manager",
                verified_at=datetime.now(UTC),
            )
        )
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
            maximum_players=1,
        )
        window = VenueTableWindow(
            venue_id=venue.id,
            recurring_rule_id=rule.id,
            table_count=1,
            max_people_per_table=2,
            approval_required=True,
        )
        session.add_all([demand, supply, window])
        session.flush()
        match = TableMatch(
            gm_supply_signal_id=supply.id,
            venue_table_window_id=window.id,
            game_system_id=system.id,
            proposed_start=datetime(2030, 8, 23, 22, 0, tzinfo=UTC),
            proposed_end=datetime(2030, 8, 24, 2, 0, tzinfo=UTC),
            timezone="America/New_York",
            minimum_players=1,
            maximum_players=1,
            compatible_player_count=1,
        )
        session.add(match)
        session.flush()
        session.add(
            TableMatchPlayer(
                table_match_id=match.id,
                player_demand_signal_id=demand.id,
                fit_flags=["system", "schedule", "distance"],
                distance_miles=5.25,
                availability_overlap={
                    "start": "2030-08-23T18:00:00-04:00",
                    "end": "2030-08-23T22:00:00-04:00",
                },
            )
        )
        session.commit()
        return match
