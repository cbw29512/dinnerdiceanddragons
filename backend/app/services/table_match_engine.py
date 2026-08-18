"""Deterministic three-sided hard-fit Table Match computation."""

from datetime import date

from app.services.geo_distance import GeoPoint
from app.services.postal_centroids import PostalCentroidResolver
from app.services.table_match_candidate_types import MatchCandidateSnapshot
from app.services.table_match_computation_context import TableMatchComputationContext
from app.services.table_match_engine_policy import (
    MAX_MATCH_HORIZON_DAYS,
    TableMatchHorizonError,
    validate_match_horizon,
)
from app.services.table_match_hard_fit import (
    CriterionDecision,
    TableCandidateFacts,
    evaluate_table_candidate,
    intersect_occurrences,
)
from app.services.table_match_opportunity import MatchOpportunity
from app.services.table_match_player_matching import find_compatible_players
from app.services.table_match_venue_allocation import (
    VenueOccurrenceCandidate,
    allocate_venue_tables,
)


def build_match_opportunities(
    snapshot: MatchCandidateSnapshot,
    *,
    postal_resolver: PostalCentroidResolver,
    window_start: date,
    window_end: date,
) -> tuple[MatchOpportunity, ...]:
    """Compute minimum-qualified opportunities capped by physical Venue tables."""

    validate_match_horizon(window_start, window_end)
    context = TableMatchComputationContext(postal_resolver)
    candidates: list[VenueOccurrenceCandidate] = []

    for gm in snapshot.gms:
        gm_occurrences = context.occurrences(gm.rule, window_start, window_end)
        for venue in snapshot.venues:
            if not venue.active or not venue.verified:
                continue
            if max(venue.max_people_per_table - 1, 0) < gm.minimum_players:
                continue

            venue_occurrences = context.occurrences(
                venue.rule,
                window_start,
                window_end,
            )
            if not any(
                intersect_occurrences(gm_occurrence, venue_occurrence) is not None
                for gm_occurrence in gm_occurrences
                for venue_occurrence in venue_occurrences
            ):
                continue

            venue_point = GeoPoint(latitude=venue.latitude, longitude=venue.longitude)
            gm_distance = context.distance_to_venue(
                gm.postal_code,
                venue.venue_id,
                venue_point,
            )

            for gm_occurrence in gm_occurrences:
                for venue_occurrence in venue_occurrences:
                    table_evaluation = evaluate_table_candidate(
                        TableCandidateFacts(
                            gm_signal_status=gm.status,
                            venue_active=venue.active,
                            venue_verified=venue.verified,
                            gm_minimum_players=gm.minimum_players,
                            gm_maximum_players=gm.maximum_players,
                            venue_max_people_per_table=venue.max_people_per_table,
                            gm_distance_miles=gm_distance,
                            gm_travel_radius_miles=gm.travel_radius_miles,
                            gm_occurrence=gm_occurrence,
                            venue_occurrence=venue_occurrence,
                        )
                    )
                    if not table_evaluation.eligible or table_evaluation.overlap is None:
                        continue

                    compatible_players = find_compatible_players(
                        gm=gm,
                        venue=venue,
                        players=snapshot.players,
                        table_overlap=table_evaluation.overlap,
                        context=context,
                        window_start=window_start,
                        window_end=window_end,
                    )
                    if len(compatible_players) < gm.minimum_players:
                        continue

                    explanations = table_evaluation.decisions + (
                        CriterionDecision(
                            criterion="player_threshold",
                            passed=True,
                            summary=(
                                f"{len(compatible_players)} compatible Players satisfy the "
                                f"GM minimum of {gm.minimum_players}."
                            ),
                        ),
                    )
                    opportunity = MatchOpportunity(
                        gm_supply_signal_id=gm.signal_id,
                        venue_table_window_id=venue.window_id,
                        game_system_id=gm.game_system_id,
                        proposed_start=table_evaluation.overlap.start_at,
                        proposed_end=table_evaluation.overlap.end_at,
                        timezone=venue.rule.timezone,
                        minimum_players=gm.minimum_players,
                        maximum_players=table_evaluation.effective_maximum_players,
                        gm_distance_miles=gm_distance,
                        players=compatible_players,
                        explanations=explanations,
                    )
                    candidates.append(
                        VenueOccurrenceCandidate(
                            opportunity=opportunity,
                            venue_occurrence_start=venue_occurrence.start_at,
                            venue_occurrence_end=venue_occurrence.end_at,
                            table_count=venue.table_count,
                        )
                    )

    return allocate_venue_tables(candidates)


__all__ = [
    "MAX_MATCH_HORIZON_DAYS",
    "TableMatchHorizonError",
    "build_match_opportunities",
]
