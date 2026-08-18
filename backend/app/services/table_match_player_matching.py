"""Player-side hard-fit aggregation for one proposed Table Match."""

from datetime import date

from app.services.geo_distance import GeoPoint
from app.services.table_match_candidate_types import GMCandidate, PlayerCandidate, VenueCandidate
from app.services.table_match_computation_context import TableMatchComputationContext
from app.services.table_match_hard_fit import (
    PlayerCandidateFacts,
    TimeWindow,
    evaluate_player_candidate,
)
from app.services.table_match_opportunity import CompatiblePlayerOpportunity


def find_compatible_players(
    *,
    gm: GMCandidate,
    venue: VenueCandidate,
    players: tuple[PlayerCandidate, ...],
    table_overlap: TimeWindow,
    context: TableMatchComputationContext,
    window_start: date,
    window_end: date,
) -> tuple[CompatiblePlayerOpportunity, ...]:
    """Return one deterministic eligible record per Player demand signal."""

    venue_point = GeoPoint(latitude=venue.latitude, longitude=venue.longitude)
    best_by_demand: dict[object, CompatiblePlayerOpportunity] = {}

    for player in players:
        if player.game_system_id != gm.game_system_id:
            continue

        distance_miles = context.distance_to_venue(
            player.postal_code,
            venue.venue_id,
            venue_point,
        )
        for occurrence in context.occurrences(player.rule, window_start, window_end):
            evaluation = evaluate_player_candidate(
                PlayerCandidateFacts(
                    player_system_id=player.game_system_id,
                    gm_system_id=gm.game_system_id,
                    player_signal_status=player.status,
                    player_format=player.preferred_format,
                    gm_format=gm.preferred_format,
                    player_distance_miles=distance_miles,
                    player_travel_radius_miles=player.travel_radius_miles,
                    player_occurrence=occurrence,
                    table_overlap=table_overlap,
                )
            )
            if not evaluation.eligible or evaluation.overlap is None:
                continue

            candidate = CompatiblePlayerOpportunity(
                demand_id=player.demand_id,
                distance_miles=distance_miles,
                overlap=evaluation.overlap,
                fit_flags=tuple(
                    decision.criterion
                    for decision in evaluation.decisions
                    if decision.passed
                ),
            )
            current = best_by_demand.get(player.demand_id)
            if current is None or _is_better_overlap(candidate, current):
                best_by_demand[player.demand_id] = candidate

    return tuple(
        best_by_demand[demand_id]
        for demand_id in sorted(best_by_demand, key=str)
    )


def _is_better_overlap(
    candidate: CompatiblePlayerOpportunity,
    current: CompatiblePlayerOpportunity,
) -> bool:
    candidate_duration = candidate.overlap.end_at - candidate.overlap.start_at
    current_duration = current.overlap.end_at - current.overlap.start_at
    if candidate_duration != current_duration:
        return candidate_duration > current_duration
    return candidate.overlap.start_at < current.overlap.start_at


__all__ = ["find_compatible_players"]
