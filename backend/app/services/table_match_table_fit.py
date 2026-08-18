"""GM + Venue hard-fit evaluation for production Table Match."""

from app.services.table_match_hard_fit_types import (
    CriterionDecision,
    TableCandidateEvaluation,
    TableCandidateFacts,
    intersect_occurrences,
)

ACTIVE_SIGNAL_STATUS = "active"


def evaluate_table_candidate(facts: TableCandidateFacts) -> TableCandidateEvaluation:
    """Evaluate GM state, Venue state, schedule, travel, and per-table capacity."""

    decisions: list[CriterionDecision] = []

    gm_active = facts.gm_signal_status == ACTIVE_SIGNAL_STATUS
    decisions.append(
        CriterionDecision(
            criterion="gm_state",
            passed=gm_active,
            summary="GM supply signal is active."
            if gm_active
            else "GM supply signal is not active.",
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
        facts.gm_distance_miles >= 0 and facts.gm_distance_miles <= facts.gm_travel_radius_miles
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


__all__ = ["evaluate_table_candidate"]
