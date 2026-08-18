"""Unit contracts for bounded synchronous Table Match work."""

import pytest

from app.services.table_match_candidate_mapping import require_bounded_candidate_rows
from app.services.table_match_candidate_types import MatchCandidateSnapshot
from app.services.table_match_engine_policy import (
    MAX_MATCH_CANDIDATE_ROWS_PER_KIND,
    MAX_MATCH_COMBINATION_BUDGET,
    TableMatchCapacityError,
    validate_match_candidate_budget,
)


def _snapshot(*, gms: int, venues: int, players: int) -> MatchCandidateSnapshot:
    return MatchCandidateSnapshot(
        gms=tuple(object() for _ in range(gms)),  # type: ignore[arg-type]
        venues=tuple(object() for _ in range(venues)),  # type: ignore[arg-type]
        players=tuple(object() for _ in range(players)),  # type: ignore[arg-type]
    )


def test_candidate_row_loader_rejects_cap_plus_one_instead_of_truncating() -> None:
    rows = tuple(object() for _ in range(MAX_MATCH_CANDIDATE_ROWS_PER_KIND + 1))

    with pytest.raises(TableMatchCapacityError, match="candidate set exceeds"):
        require_bounded_candidate_rows(rows, kind="Player")


def test_candidate_work_budget_allows_small_snapshot() -> None:
    snapshot = _snapshot(gms=10, venues=10, players=10)

    validate_match_candidate_budget(snapshot)


def test_candidate_work_budget_rejects_excessive_nested_work() -> None:
    players = 20
    side = 110
    assert side * side * (players + 1) > MAX_MATCH_COMBINATION_BUDGET
    snapshot = _snapshot(gms=side, venues=side, players=players)

    with pytest.raises(TableMatchCapacityError, match="processing budget"):
        validate_match_candidate_budget(snapshot)
