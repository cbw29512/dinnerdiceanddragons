"""Bounded-work and deterministic policy for production Table Match."""

import logging
from datetime import date

from app.services.table_match_candidate_types import MatchCandidateSnapshot
from app.services.table_match_opportunity import MatchOpportunity

LOGGER = logging.getLogger(__name__)

MAX_MATCH_HORIZON_DAYS = 90
MAX_MATCH_CANDIDATE_ROWS_PER_KIND = 500
MAX_MATCH_COMBINATION_BUDGET = 50_000


class TableMatchHorizonError(ValueError):
    """A requested matching horizon is invalid or unbounded."""


class TableMatchCapacityError(RuntimeError):
    """The current candidate set exceeds the safe synchronous work budget."""


def validate_match_horizon(window_start: date, window_end: date) -> None:
    """Reject reversed or excessively large matching search windows."""

    if window_start > window_end:
        raise TableMatchHorizonError("Match horizon start cannot be after its end.")
    if (window_end - window_start).days > MAX_MATCH_HORIZON_DAYS:
        raise TableMatchHorizonError(f"Match horizon cannot exceed {MAX_MATCH_HORIZON_DAYS} days.")


def validate_match_candidate_budget(snapshot: MatchCandidateSnapshot) -> None:
    """Reject a snapshot before nested GM x Venue x Player work becomes excessive."""

    try:
        work_units = len(snapshot.gms) * len(snapshot.venues) * (len(snapshot.players) + 1)
        if work_units > MAX_MATCH_COMBINATION_BUDGET:
            raise TableMatchCapacityError(
                "Table Match candidate set exceeds the safe synchronous processing budget."
            )
    except TableMatchCapacityError:
        raise
    except Exception:
        LOGGER.exception("Failed to validate Table Match candidate work budget")
        raise


def prefer_opportunity(candidate: MatchOpportunity, current: MatchOpportunity) -> bool:
    """Choose deterministically when equivalent occurrence keys are recomputed."""

    if candidate.compatible_player_count != current.compatible_player_count:
        return candidate.compatible_player_count > current.compatible_player_count
    return tuple(str(player.demand_id) for player in candidate.players) < tuple(
        str(player.demand_id) for player in current.players
    )


__all__ = [
    "MAX_MATCH_CANDIDATE_ROWS_PER_KIND",
    "MAX_MATCH_COMBINATION_BUDGET",
    "MAX_MATCH_HORIZON_DAYS",
    "TableMatchCapacityError",
    "TableMatchHorizonError",
    "prefer_opportunity",
    "validate_match_candidate_budget",
    "validate_match_horizon",
]
