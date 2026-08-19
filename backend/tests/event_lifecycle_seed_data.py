"""Canonical seed records for Event lifecycle and registration tests."""

from datetime import UTC, datetime, time

from event_lifecycle_player_seed import seed_lifecycle_players
from event_lifecycle_seed_types import LifecycleSeed
from sqlalchemy.orm import Session

from app.models.event import Event
from app.models.game_system import GameSystem
from app.models.gm_profile import GMProfile
from app.models.gm_supply_signal import GMSupplySignal
from app.models.recurring_availability_rule import RecurringAvailabilityRule
from app.models.table_match import TableMatch
from app.models.user import AccountStatus, User
from app.models.user_role import UserRole, UserRoleType
from app.models.venue import Venue
from app.models.venue_booking_request import VenueBookingRequest
from app.models.venue_table_window import VenueTableWindow


def seed_lifecycle_inputs(session: Session, player_count: int) -> LifecycleSeed:
    """Persist one matched Event with deterministic eligible Players."""

    try:
        system = GameSystem(name="D&D", edition="5e 2024", slug="dnd-5e-2024")
        gm_user = User(
            auth_provider_user_id="lifecycle-gm",
            email="lifecycle-gm@example.test",
            status=AccountStatus.ACTIVE.value,
        )
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
        session.add(UserRole(user_id=gm_user.id, role=UserRoleType.GM.value))

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
        player_users, player_profiles, player_demands = seed_lifecycle_players(
            session,
            system,
            match,
            player_count,
        )

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
        return LifecycleSeed(
            event_id=event.id,
            booking_id=booking.id,
            match_id=match.id,
            gm_user=gm_user,
            player_users=tuple(player_users),
            player_profiles=tuple(player_profiles),
            player_demands=tuple(player_demands),
        )
    except Exception:
        raise


__all__ = ["LifecycleSeed", "seed_lifecycle_inputs"]
