"""Core product proof for GM supply + Player demand + Venue capacity matching."""

from datetime import date, time
from uuid import uuid4

from app.models.recurring_availability_rule import RecurringAvailabilityRule
from app.services.postal_centroids import PostalCentroidResult
from app.services.table_match_candidate_types import (
    GMCandidate,
    MatchCandidateSnapshot,
    PlayerCandidate,
    VenueCandidate,
)
from app.services.table_match_engine import build_match_opportunities


class SamePlacePostalResolver:
    """Keep the test about hard-fit composition rather than geocoder behavior."""

    def resolve(self, postal_code: str) -> PostalCentroidResult:
        return PostalCentroidResult(
            postal_code=postal_code,
            latitude=34.1954,
            longitude=-79.7626,
            accuracy=1.0,
            accuracy_type="place",
            provider="test",
        )


def _rule(day: str) -> RecurringAvailabilityRule:
    return RecurringAvailabilityRule(
        id=uuid4(),
        day_of_week=day,
        start_time=time(18, 0),
        end_time=time(22, 0),
        pattern_type="weekly_interval",
        week_interval=1,
        timezone="America/New_York",
        active=True,
    )


def _snapshot(*, player_day: str = "friday") -> MatchCandidateSnapshot:
    system_id = uuid4()
    gm = GMCandidate(
        signal_id=uuid4(),
        game_system_id=system_id,
        preferred_format="one_shot",
        minimum_players=3,
        maximum_players=5,
        status="active",
        postal_code="29501",
        travel_radius_miles=25,
        rule=_rule("friday"),
    )
    venue = VenueCandidate(
        window_id=uuid4(),
        venue_id=uuid4(),
        table_count=1,
        max_people_per_table=6,
        active=True,
        verified=True,
        latitude=34.1954,
        longitude=-79.7626,
        rule=_rule("friday"),
    )
    players = tuple(
        PlayerCandidate(
            demand_id=uuid4(),
            player_profile_id=uuid4(),
            game_system_id=system_id,
            preferred_format="one_shot",
            status="active",
            postal_code="29501",
            travel_radius_miles=25,
            rule=_rule(player_day),
        )
        for _ in range(3)
    )
    return MatchCandidateSnapshot(gms=(gm,), venues=(venue,), players=players)


def test_matching_gm_players_and_venue_produce_boom_opportunity() -> None:
    """All three independent signals align, so one runnable Table can happen."""

    opportunities = build_match_opportunities(
        _snapshot(),
        postal_resolver=SamePlacePostalResolver(),
        window_start=date(2026, 8, 21),
        window_end=date(2026, 8, 21),
    )

    assert len(opportunities) == 1
    boom = opportunities[0]
    assert boom.minimum_players == 3
    assert boom.maximum_players == 5
    assert boom.compatible_player_count == 3
    assert boom.proposed_start.hour == 18
    assert boom.proposed_end.hour == 22
    assert boom.timezone == "America/New_York"


def test_time_mismatch_prevents_false_boom() -> None:
    """Same game/area is not enough when Player demand is on another day."""

    opportunities = build_match_opportunities(
        _snapshot(player_day="saturday"),
        postal_resolver=SamePlacePostalResolver(),
        window_start=date(2026, 8, 21),
        window_end=date(2026, 8, 22),
    )

    assert opportunities == ()
