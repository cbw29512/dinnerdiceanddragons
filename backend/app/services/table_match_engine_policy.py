"""Bounded-horizon and deterministic dedup policy for Table Match."""

from datetime import date

from app.services.table_match_opportunity import MatchOpportunity

MAX_MATCH_HORIZON_DAYS = 90


class TableMatchHorizonError(ValueError):
    """A requested matching horizon is invalid or unbounded."""


def validate_match_horizon(window_start: date, window_end: date) -> None:
    """Reject reversed or excessively large matching search windows."""

    if window_start > window_end:
        raise TableMatchHorizonError("Match horizon start cannot be after its end.")
    if (window_end - window_start).days > MAX_MATCH_HORIZON_DAYS:
        raise TableMatchHorizonError(f"Match horizon cannot exceed {MAX_MATCH_HORIZON_DAYS} days.")


def prefer_opportunity(candidate: MatchOpportunity, current: MatchOpportunity) -> bool:
    """Choose deterministically when equivalent occurrence keys are recomputed."""

    if candidate.compatible_player_count != current.compatible_player_count:
        return candidate.compatible_player_count > current.compatible_player_count
    return tuple(str(player.demand_id) for player in candidate.players) < tuple(
        str(player.demand_id) for player in current.players
    )


__all__ = [
    "MAX_MATCH_HORIZON_DAYS",
    "TableMatchHorizonError",
    "prefer_opportunity",
    "validate_match_horizon",
]
