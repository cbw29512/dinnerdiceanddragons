"""Integration tests for stale-potential expiration and safe reactivation."""

from datetime import date

from sqlalchemy import select
from table_match_runner_test_support import build_runner_factory

from app.models.player_demand_signal import PlayerDemandSignal
from app.models.table_match import TableMatch, TableMatchStatus
from app.services.postal_centroids import PostalCentroidResult
from app.services.table_match_runner import run_table_match

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


def test_stale_potential_expires_and_same_opportunity_can_reactivate() -> None:
    factory = build_runner_factory(player_count=3, gm_minimum_players=3)
    resolver = StaticPostalResolver()

    first = _run(factory, resolver)
    assert first.computed_opportunities == 1
    with factory() as session:
        match = session.scalar(select(TableMatch))
        assert match is not None
        original_id = match.id
        assert match.status == TableMatchStatus.POTENTIAL.value

        demands = session.scalars(select(PlayerDemandSignal)).all()
        for demand in demands:
            demand.status = "paused"
        session.commit()

    second = _run(factory, resolver)
    assert second.computed_opportunities == 0
    assert second.expired_count == 1
    with factory() as session:
        match = session.get(TableMatch, original_id)
        assert match is not None
        assert match.status == TableMatchStatus.EXPIRED.value

        demands = session.scalars(select(PlayerDemandSignal)).all()
        for demand in demands:
            demand.status = "active"
        session.commit()

    third = _run(factory, resolver)
    assert third.computed_opportunities == 1
    assert third.expired_count == 0
    assert third.persisted[0].created is False
    assert third.persisted[0].refreshed is True
    assert third.persisted[0].table_match_id == original_id
    with factory() as session:
        match = session.get(TableMatch, original_id)
        assert match is not None
        assert match.status == TableMatchStatus.POTENTIAL.value


def _run(factory, resolver: StaticPostalResolver):
    return run_table_match(
        window_start=MATCH_DATE,
        window_end=MATCH_DATE,
        session_factory=factory,
        postal_resolver=resolver,
    )
