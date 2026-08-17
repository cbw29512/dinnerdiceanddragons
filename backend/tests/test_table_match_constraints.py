"""Database invariant tests for persisted Table Match opportunities."""

from datetime import UTC, datetime
from decimal import Decimal

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.match_explanation import MatchExplanation
from app.models.table_match import TableMatch
from app.models.table_match_player import TableMatchPlayer
from table_match_test_support import MatchSeed, create_table_match_session, seed_match_inputs


@pytest.fixture()
def session() -> Session:
    db, engine = create_table_match_session()
    try:
        yield db
    finally:
        db.close()
        engine.dispose()


def new_match(seed: MatchSeed, *, hour: int = 22) -> TableMatch:
    return TableMatch(
        gm_supply_signal_id=seed.gm_supply.id,
        venue_table_window_id=seed.venue_window.id,
        game_system_id=seed.system.id,
        proposed_start=datetime(2026, 8, 22, hour, 0, tzinfo=UTC),
        proposed_end=datetime(2026, 8, 23, 2, 0, tzinfo=UTC),
        timezone="America/New_York",
        minimum_players=3,
        maximum_players=5,
        compatible_player_count=1,
        fit_score=Decimal("80.00"),
    )


def test_duplicate_gm_venue_occurrence_is_rejected(session: Session) -> None:
    seed = seed_match_inputs(session)
    session.add_all([new_match(seed), new_match(seed)])

    with pytest.raises(IntegrityError):
        session.commit()
    session.rollback()


def test_match_rejects_non_positive_occurrence_window(session: Session) -> None:
    seed = seed_match_inputs(session)
    match = new_match(seed)
    match.proposed_end = match.proposed_start
    session.add(match)

    with pytest.raises(IntegrityError):
        session.commit()
    session.rollback()


def test_match_player_rejects_negative_distance(session: Session) -> None:
    seed = seed_match_inputs(session)
    match = new_match(seed)
    session.add(match)
    session.flush()
    session.add(
        TableMatchPlayer(
            table_match_id=match.id,
            player_demand_signal_id=seed.player_demand.id,
            distance_miles=Decimal("-0.01"),
        )
    )

    with pytest.raises(IntegrityError):
        session.commit()
    session.rollback()


def test_match_explanation_criterion_is_unique_per_match(session: Session) -> None:
    seed = seed_match_inputs(session)
    match = new_match(seed)
    session.add(match)
    session.flush()
    session.add_all(
        [
            MatchExplanation(
                table_match_id=match.id,
                criterion="system",
                result="pass",
                summary="System matches.",
            ),
            MatchExplanation(
                table_match_id=match.id,
                criterion="system",
                result="pass",
                summary="Duplicate system explanation.",
            ),
        ]
    )

    with pytest.raises(IntegrityError):
        session.commit()
    session.rollback()
