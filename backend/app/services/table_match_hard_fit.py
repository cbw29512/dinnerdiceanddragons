"""Pure deterministic hard-fit rules for production Table Match."""

from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID

from app.services.recurrence_expansion import OccurrenceWindow

ACTIVE_SIGNAL_STATUS = "active"
ANY_GAME_FORMAT = "any"


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

    first_start = first.start_at.astimezone(UTC)
    first_end = first.end_at.astimezone(UTC)
    second_start = second.start_at.astimezone(UTC)
    second_end = second.end_at.astimezone(UTC)

    start_at = max(first_start, second_start)
    end_at = min(first_end, second_end)
    if end_at <= start_at:
        return None
    return TimeWindow(start_at=start_at, end_at=end_at)


def evaluate_table_candidate(facts: TableCandidateFacts) -> TableCandidateEvaluation:
    """Evaluate GM state, Venue state, schedule, travel, and per-table capacity."""

    decisions: list[CriterionDecision] = []

    gm_active = facts.gm_signal_status == ACTIVE_SIGNAL_STATUS
    decisions.append(
        CriterionDecision(
            criterion="gm_state",
            passed=gm_active,
            summary=(
                "GM supply signal is active."
                if gm_active
                else "GM supply signal is not active."
            ),
        )
    )

    venue_eligible = facts.venue_active and facts.venue_verified
    decisions.append(
        CriterionDecision(
            criterion="venue_state",
            passed=venue_eligible,
            summary=(
                "Venue is active and verified."
                if venue_eligible
                else "Venue must be active and verified for production matching."
            ),
        )
    )

    overlap = intersect_occurrences(facts.gm_occurrence, facts.venue_occurrence)
    decisions.append(
        CriterionDecision(
            criterion="schedule",
            passed=overlap is not None,
            summary=(
                "GM and Venue recurrence occurrences overlap."
                if overlap is not None
                else "GM and Venue recurrence occurrences do not overlap."
            ),
        )
    )

    gm_travel_ok = (
        facts.gm_distance_miles >= 0
        and facts.gm_distance_miles <= facts.gm_travel_radius_miles
    )
    decisions.append(
        CriterionDecision(
            criterion="gm_distance",
            passed=gm_travel_ok,
            summary=(
                f"Venue is approximately {facts.gm_distance_miles:.1f} miles from the GM anchor, "
                f"within the {facts.gm_travel_radius_miles}-mile radius."
                if gm_travel_ok
                else f"Venue is approximately {facts.gm_distance_miles:.1f} miles from the GM anchor, "
                f"outside the {facts.gm_travel_radius_miles}-mile radius."
            ),
        )
    )

    venue_player_capacity = max(facts.venue_max_people_per_table - 1, 0)
    effective_maximum = min(facts.gm_maximum_players, venue_player_capacity)
    capacity_ok = (
        facts.gm_minimum_players >= 1
        and facts.gm_maximum_players >= facts.gm_minimum_players
        and effective_maximum >= facts.gm_minimum_players
    )
    decisions.append(
        CriterionDecision(
            criterion="venue_capacity",
            passed=capacity_ok,
            summary=(
                "Venue capacity includes the GM seat and supports the GM Player range."
                if capacity_ok
                else "Venue table capacity cannot satisfy the GM minimum Player requirement after reserving the GM seat."
            ),
        )
    )

    return TableCandidateEvaluation(
        eligible=all(decision.passed for decision in decisions),
        overlap=overlap,
        effective_maximum_players=effective_maximum,
        decisions=tuple(decisions),
    )


def evaluate_player_candidate(facts: PlayerCandidateFacts) -> PlayerCandidateEvaluation:
    """Evaluate one Player against an already evaluated GM + Venue table."""

    decisions: list[CriterionDecision] = []

    system_ok = facts.player_system_id == facts.gm_system_id
    decisions.append(
        CriterionDecision(
            criterion="system",
            passed=system_ok,
            summary=(
                "Player and GM selected the same canonical game system and edition."
                if system_ok
                else "Player and GM game systems or editions do not match."
            ),
        )
    )

    player_active = facts.player_signal_status == ACTIVE_SIGNAL_STATUS
    decisions.append(
        CriterionDecision(
            criterion="player_state",
            passed=player_active,
            summary=(
                "Player demand signal is active."
                if player_active
                else "Player demand signal is not active."
            ),
        )
    )

    format_ok = facts.player_format in {ANY_GAME_FORMAT, facts.gm_format}
    decisions.append(
        CriterionDecision(
            criterion="format",
            passed=format_ok,
            summary=(
                "Player game-format preference is compatible with the GM offer."
                if format_ok
                else "Player game-format preference is incompatible with the GM offer."
            ),
        )
    )

    overlap = intersect_occurrences(facts.player_occurrence, facts.table_overlap)
    decisions.append(
        CriterionDecision(
            criterion="schedule",
            passed=overlap is not None,
            summary=(
                "Player availability overlaps the proposed table occurrence."
                if overlap is not None
                else "Player availability does not overlap the proposed table occurrence."
            ),
        )
    )

    player_travel_ok = (
        facts.player_distance_miles >= 0
        and facts.player_distance_miles <= facts.player_travel_radius_miles
    )
    decisions.append(
        CriterionDecision(
            criterion="distance",
            passed=player_travel_ok,
            summary=(
                f"Venue is approximately {facts.player_distance_miles:.1f} miles from the Player anchor, "
                f"within the {facts.player_travel_radius_miles}-mile radius."
                if player_travel_ok
                else f"Venue is approximately {facts.player_distance_miles:.1f} miles from the Player anchor, "
                f"outside the {facts.player_travel_radius_miles}-mile radius."
            ),
        )
    )

    return PlayerCandidateEvaluation(
        eligible=all(decision.passed for decision in decisions),
        overlap=overlap,
        decisions=tuple(decisions),
    )


__all__ = [
    "CriterionDecision",
    "PlayerCandidateEvaluation",
    "PlayerCandidateFacts",
    "TableCandidateEvaluation",
    "TableCandidateFacts",
    "TimeWindow",
    "evaluate_player_candidate",
    "evaluate_table_candidate",
    "intersect_occurrences",
]
