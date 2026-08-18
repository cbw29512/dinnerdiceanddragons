"""End-to-end integration tests for deterministic Table Match generation."""

from datetime import date

from sqlalchemy import func, select

from app.models.match_explanation import MatchExplanation
from app.models.table_match import TableMatch
from app.models.table_match_player import TableMatchPlayer
from app.services.postal_centroids import PostalCentroidResult
from app.services.table_match_runner import run_table_match
from table_match_runner_test_support import build_runner_factory

MATCH_DATE = date(2026, 8, 21)


class StaticPostalResolver:
    """Return the Florence test centroid without any network or cache dependency."""

    def resolve(self, postal_code: str) -> PostalCentroidResult:
        return PostalCentroidResult(
            postal_code=postal_code,
            latitude=34.1954,
            longitude=-79.7626,
            accuracy=1.0,
            accuracy_type="place",
            provider="test",
        )


def test_runner_persists_minimum_qualified_three_sided_match() -> None:
    factory = build_runner_factory()

    result = run_table_match(
        window_start=MATCH_DATE,
        window_end=MATCH_DATE,
        session_factory=factory,
        postal_resolver=StaticPostalResolver(),
    )

    assert result.computed_opportunities == 1
    assert len(result.persisted) == 1
    assert result.persisted[0].created is True

    with factory() as session:
        match = session.scalar(select(TableMatch))
        assert match is not None
        assert match.compatible_player_count == 3
        assert match.minimum_players == 3
        assert match.maximum_players == 5
        assert match.distance_summary["distance_type"] == "approximate_straight_line"
        assert "postal_code" not in match.distance_summary

        assert session.scalar(select(func.count()).select_from(TableMatchPlayer)) == 3
        criteria = set(session.scalars(select(MatchExplanation.criterion)))
        assert "player_threshold" in criteria
        assert "gm_distance" in criteria
        assert "venue_capacity" in criteria


def test_runner_recomputation_refreshes_without_duplicate_match_or_children() -> None:
    factory = build_runner_factory()
    resolver = StaticPostalResolver()

    first = run_table_match(
        window_start=MATCH_DATE,
        window_end=MATCH_DATE,
        session_factory=factory,
        postal_resolver=resolver,
    )
    second = run_table_match(
        window_start=MATCH_DATE,
        window_end=MATCH_DATE,
        session_factory=factory,
        postal_resolver=resolver,
    )

    assert first.persisted[0].created is True
    assert second.persisted[0].created is False
    assert second.persisted[0].refreshed is True

    with factory() as session:
        assert session.scalar(select(func.count()).select_from(TableMatch)) == 1
        assert session.scalar(select(func.count()).select_from(TableMatchPlayer)) == 3
        assert session.scalar(select(func.count()).select_from(MatchExplanation)) == 6


def test_runner_does_not_persist_below_gm_minimum_player_threshold() -> None:
    factory = build_runner_factory(player_count=2, gm_minimum_players=3)

    result = run_table_match(
        window_start=MATCH_DATE,
        window_end=MATCH_DATE,
        session_factory=factory,
        postal_resolver=StaticPostalResolver(),
    )

    assert result.computed_opportunities == 0
    assert result.persisted == ()
    with factory() as session:
        assert session.scalar(select(func.count()).select_from(TableMatch)) == 0


def test_runner_rejects_unverified_venue() -> None:
    factory = build_runner_factory(venue_verified=False)

    result = run_table_match(
        window_start=MATCH_DATE,
        window_end=MATCH_DATE,
        session_factory=factory,
        postal_resolver=StaticPostalResolver(),
    )

    assert result.computed_opportunities == 0
    with factory() as session:
        assert session.scalar(select(func.count()).select_from(TableMatch)) == 0
