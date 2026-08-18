"""Player-side hard-fit evaluation for production Table Match."""

from app.services.table_match_hard_fit_types import (
    CriterionDecision,
    PlayerCandidateEvaluation,
    PlayerCandidateFacts,
    intersect_occurrences,
)

ACTIVE_SIGNAL_STATUS = "active"
ANY_GAME_FORMAT = "any"


def evaluate_player_candidate(facts: PlayerCandidateFacts) -> PlayerCandidateEvaluation:
    """Evaluate one Player against an already eligible GM + Venue table."""

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


__all__ = ["evaluate_player_candidate"]
