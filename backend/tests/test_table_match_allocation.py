"""Integration tests for human-seat and physical Venue allocation rules."""

from datetime import date, time

from sqlalchemy import func, select

from app.models.availability_window import GMAvailabilityWindow
from app.models.game_system import GameSystem
from app.models.gm_profile import GMProfile
from app.models.gm_supply_signal import GMSupplySignal
from app.models.player_demand_signal import PlayerDemandSignal
from app.models.player_profile import PlayerProfile
from app.models.recurring_availability_rule import RecurringAvailabilityRule
from app.models.table_match import TableMatch
from app.models.table_match_player import TableMatchPlayer
from app.models.user import AccountStatus, User
from app.services.postal_centroids import PostalCentroidResult
from app.services.table_match_runner import run_table_match
from table_match_runner_test_support import build_runner_factory

MATCH_DATE = date(2026, 8, 21)


class StaticPostalResolver:
    def resolve(self, postal_code: str) -> PostalCentroidResult:
        return PostalCentroidResult(
            postal_code=postal_code,
            latitude=34.1954,
            longitude=-79.7626,
            accuracy=1.0,
            accuracy_type="place",
            provider="test",
        )


def test_multiple_demands_from_one_player_count_as_one_human_seat() -> None:
    factory = build_runner_factory(player_count=3, gm_minimum_players=3)
    with factory() as session:
        profile = session.scalar(select(PlayerProfile).order_by(PlayerProfile.id))
        system = session.scalar(select(GameSystem))
        assert profile is not None and system is not None
        session.add(
            PlayerDemandSignal(
                player_profile_id=profile.id,
                game_system_id=system.id,
                preferred_format="one_shot",
            )
        )
        session.commit()

    result = _run(factory)

    assert result.computed_opportunities == 1
    with factory() as session:
        match = session.scalar(select(TableMatch))
        assert match is not None
        assert match.compatible_player_count == 3
        assert session.scalar(select(func.count()).select_from(TableMatchPlayer)) == 3


def test_venue_table_count_caps_simultaneous_matches() -> None:
    factory = build_runner_factory(player_count=3, gm_minimum_players=3)
    with factory() as session:
        system = session.scalar(select(GameSystem))
        assert system is not None
        _add_gm(session, system, 1)
        _add_gm(session, system, 2)
        session.commit()

    result = _run(factory)

    assert result.computed_opportunities == 2
    assert len(result.persisted) == 2
    with factory() as session:
        assert session.scalar(select(func.count()).select_from(TableMatch)) == 2


def _run(factory):
    return run_table_match(
        window_start=MATCH_DATE,
        window_end=MATCH_DATE,
        session_factory=factory,
        postal_resolver=StaticPostalResolver(),
    )


def _add_gm(session, system: GameSystem, index: int) -> None:
    user = User(
        auth_provider_user_id=f"allocation-gm-{index}",
        email=f"allocation-gm-{index}@example.test",
        status=AccountStatus.ACTIVE.value,
    )
    session.add(user)
    session.flush()
    profile = GMProfile(
        user_id=user.id,
        postal_code="29501",
        travel_radius_miles=25,
        gm_style=f"Allocation GM {index}.",
    )
    rule = RecurringAvailabilityRule(
        day_of_week="friday",
        start_time=time(18, 0),
        end_time=time(22, 0),
        pattern_type="weekly_interval",
        week_interval=1,
        timezone="America/New_York",
    )
    session.add_all([profile, rule])
    session.flush()
    session.add_all(
        [
            GMAvailabilityWindow(
                gm_profile_id=profile.id,
                recurring_rule_id=rule.id,
            ),
            GMSupplySignal(
                gm_profile_id=profile.id,
                game_system_id=system.id,
                preferred_format="one_shot",
                minimum_players=3,
                maximum_players=5,
            ),
        ]
    )
