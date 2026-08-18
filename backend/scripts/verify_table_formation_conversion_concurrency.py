"""Real PostgreSQL race check for duplicate TableMatch formation requests."""

from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, time
from threading import Barrier
from uuid import uuid4

from sqlalchemy import func, select

from app.db.session import get_session_factory
from app.models.event import Event
from app.models.game_system import GameSystem
from app.models.gm_profile import GMProfile
from app.models.gm_supply_signal import GMSupplySignal
from app.models.recurring_availability_rule import RecurringAvailabilityRule
from app.models.table_match import TableMatch
from app.models.user import AccountStatus, User
from app.models.user_role import UserRole, UserRoleType
from app.models.venue import Venue
from app.models.venue_table_window import VenueTableWindow
from app.services.table_formation_conversion import form_table_match

FACTORY = get_session_factory()


def main() -> None:
    match_id, gm_user_id = _seed_match()
    barrier = Barrier(2)

    def convert(_: int):
        with FACTORY() as session:
            barrier.wait()
            return form_table_match(
                session,
                table_match_id=match_id,
                caller_user_id=gm_user_id,
                title="Concurrent Formation",
            )

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(convert, (1, 2)))

    assert {result.event_id for result in results} == {results[0].event_id}, results
    assert {result.game_series_id for result in results} == {results[0].game_series_id}, results
    assert sum(result.created for result in results) == 1, results

    with FACTORY() as session:
        event_count = int(
            session.scalar(
                select(func.count()).select_from(Event).where(Event.table_match_id == match_id)
            )
            or 0
        )
        assert event_count == 1, event_count

    print("Concurrent TableMatch formation verification passed.")


def _seed_match():
    with FACTORY() as session:
        system = session.scalar(
            select(GameSystem).where(GameSystem.slug == "dnd-5e-2014")
        )
        assert system is not None
        token = uuid4().hex[:8]
        user = User(
            auth_provider_user_id=f"formation-conversion-gm-{token}",
            email=f"formation-conversion-gm-{token}@example.test",
            status=AccountStatus.ACTIVE.value,
        )
        venue = Venue(
            name=f"Formation Conversion Venue {token}",
            slug=f"formation-conversion-{token}",
            venue_type="cafe",
            address_line1="123 Conversion Way",
            city="Florence",
            state_region="SC",
            postal_code="29501",
            latitude=34.1954,
            longitude=-79.7626,
            verified=True,
        )
        session.add_all([user, venue])
        session.flush()
        session.add(UserRole(user_id=user.id, role=UserRoleType.GM.value))
        gm = GMProfile(
            user_id=user.id,
            postal_code="29501",
            travel_radius_miles=25,
            gm_style="Concurrency conversion GM.",
        )
        rule = RecurringAvailabilityRule(
            day_of_week="friday",
            start_time=time(18, 0),
            end_time=time(22, 0),
            pattern_type="weekly_interval",
            week_interval=1,
            timezone="America/New_York",
        )
        session.add_all([gm, rule])
        session.flush()
        supply = GMSupplySignal(
            gm_profile_id=gm.id,
            game_system_id=system.id,
            preferred_format="one_shot",
            minimum_players=1,
            maximum_players=5,
        )
        window = VenueTableWindow(
            venue_id=venue.id,
            recurring_rule_id=rule.id,
            table_count=1,
            max_people_per_table=6,
            approval_required=True,
        )
        session.add_all([supply, window])
        session.flush()
        match = TableMatch(
            gm_supply_signal_id=supply.id,
            venue_table_window_id=window.id,
            game_system_id=system.id,
            proposed_start=datetime(2099, 8, 21, 22, 0, tzinfo=UTC),
            proposed_end=datetime(2099, 8, 22, 2, 0, tzinfo=UTC),
            timezone="America/New_York",
            minimum_players=1,
            maximum_players=5,
            compatible_player_count=1,
        )
        session.add(match)
        session.commit()
        return match.id, user.id


if __name__ == "__main__":
    main()
