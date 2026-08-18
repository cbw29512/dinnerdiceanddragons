"""Shared value objects for deterministic Table Match hard-fit evaluation."""

from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID

from app.services.recurrence_expansion import OccurrenceWindow


@dataclass(frozen=True, slots=True)
class TimeWindow:
    """One concrete timezone-aware overlap window."""

    start_at: datetime
    end_at: datetime

    def __post_init__(self) -> None:
        if self.start_at.utcoffset() is None or self.end_at.utcoffset() is None:
            raise ValueError("Hard-fit windows must be timezone-aware.")
        if self.end_at.astimezone(UTC) <= self.start_at.astimezone(UTC):
            raise ValueError("Hard-fit window end must be after start.")


@dataclass(frozen=True, slots=True)
class CriterionDecision:
    """One explainable hard-fit criterion result."""

    criterion: str
    passed: bool
    summary: str


@dataclass(frozen=True, slots=True)
class TableCandidateFacts:
    """Facts needed to evaluate one GM + Venue occurrence."""

    gm_signal_status: str
    venue_active: bool
    venue_verified: bool
    gm_minimum_players: int
    gm_maximum_players: int
    venue_max_people_per_table: int
    gm_distance_miles: float
    gm_travel_radius_miles: int
    gm_occurrence: OccurrenceWindow
    venue_occurrence: OccurrenceWindow


@dataclass(frozen=True, slots=True)
class TableCandidateEvaluation:
    """Hard-fit result for the GM + Venue side of a Table Match."""

    eligible: bool
    overlap: TimeWindow | None
    effective_maximum_players: int
    decisions: tuple[CriterionDecision, ...]


@dataclass(frozen=True, slots=True)
class PlayerCandidateFacts:
    """Facts needed to evaluate one Player against an eligible table."""

    player_system_id: UUID
    gm_system_id: UUID
    player_signal_status: str
    player_format: str
    gm_format: str
    player_distance_miles: float
    player_travel_radius_miles: int
    player_occurrence: OccurrenceWindow
    table_overlap: TimeWindow


@dataclass(frozen=True, slots=True)
class PlayerCandidateEvaluation:
    """Hard-fit result for one Player demand signal."""

    eligible: bool
    overlap: TimeWindow | None
    decisions: tuple[CriterionDecision, ...]


def intersect_occurrences(
    first: OccurrenceWindow | TimeWindow,
    second: OccurrenceWindow | TimeWindow,
) -> TimeWindow | None:
    """Return the real overlap between two timezone-aware occurrence windows."""

    start_at = max(first.start_at.astimezone(UTC), second.start_at.astimezone(UTC))
    end_at = min(first.end_at.astimezone(UTC), second.end_at.astimezone(UTC))
    if end_at <= start_at:
        return None
    return TimeWindow(start_at=start_at, end_at=end_at)


__all__ = [
    "CriterionDecision",
    "PlayerCandidateEvaluation",
    "PlayerCandidateFacts",
    "TableCandidateEvaluation",
    "TableCandidateFacts",
    "TimeWindow",
    "intersect_occurrences",
]
