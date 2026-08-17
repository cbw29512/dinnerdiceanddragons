"""Round-trip and cascade tests for persisted Table Match opportunities."""

from datetime import UTC, datetime
from decimal import Decimal

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from table_match_test_support import create_table_match_session, seed_match_inputs

from app.models.match_explanation import MatchCriterionResult, MatchExplanation
from app.models.table_match import TableMatch
from app.models.table_match_player import TableMatchPlayer


@pytest.fixture()
def session() -> Session:
    db, engine = create_table_match_session()
    try:
        yield db
    finally:
        db.close()
        engine.dispose()


def create_match(session: Session) -> TableMatch:
    seed = seed_match_inputs(session)
    match = TableMatch(
        gm_supply_signal_id=seed.gm_supply.id,
        venue_table_window_id=seed.venue_window.id,
        game_system_id=seed.system.id,
        proposed_start=datetime(2026, 8, 22, 22, 0, tzinfo=UTC),
        proposed_end=datetime(2026, 8, 23, 2, 0, tzinfo=UTC),
        timezone="America/New_York",
        minimum_players=3,
        maximum_players=5,
        compatible_player_count=1,
        distance_summary={"gm_miles": 4.2, "furthest_player_miles": 8.7},
        fit_score=Decimal("88.50"),
    )
    session.add(match)
    session.flush()

    session.add_all(
        [
            TableMatchPlayer(
                table_match_id=match.id,
                player_demand_signal_id=seed.player_demand.id,
                fit_flags=["system", "schedule", "distance"],
                distance_miles=Decimal("8.70"),
                availability_overlap={
                    "start": "2026-08-22T18:00:00-04:00",
                    "end": "2026-08-22T22:00:00-04:00",
                },
            ),
            MatchExplanation(
                table_match_id=match.id,
                criterion="venue_capacity",
                result=MatchCriterionResult.PASS.value,
                summary="Venue seats the GM plus the maximum five Players.",
                weight=Decimal("1.0000"),
            ),
        ]
    )
    session.commit()
    return match


def test_explainable_table_match_round_trips(session: Session) -> None:
    match = create_match(session)

    loaded = session.get(TableMatch, match.id)
    assert loaded is not None
    assert loaded.minimum_players == 3
    assert loaded.maximum_players == 5
    assert loaded.compatible_player_count == 1
    assert loaded.fit_score == Decimal("88.50")
    assert loaded.distance_summary["gm_miles"] == 4.2

    player = session.scalar(
        select(TableMatchPlayer).where(TableMatchPlayer.table_match_id == match.id)
    )
    assert player is not None
    assert player.distance_miles == Decimal("8.70")
    assert player.fit_flags == ["system", "schedule", "distance"]
    assert player.availability_overlap["start"].endswith("-04:00")

    explanation = session.scalar(
        select(MatchExplanation).where(MatchExplanation.table_match_id == match.id)
    )
    assert explanation is not None
    assert explanation.criterion == "venue_capacity"
    assert explanation.result == MatchCriterionResult.PASS.value


def test_deleting_match_cascades_player_facts_and_explanations(session: Session) -> None:
    match = create_match(session)

    session.delete(match)
    session.commit()

    assert session.scalar(select(func.count()).select_from(TableMatchPlayer)) == 0
    assert session.scalar(select(func.count()).select_from(MatchExplanation)) == 0
