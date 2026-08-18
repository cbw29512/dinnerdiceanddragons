"""Player-side hard-fit aggregation for one proposed Table Match."""

from datetime import date
from uuid import UUID

from app.services.geo_distance import GeoPoint
from app.services.table_match_candidate_types import GMCandidate, PlayerCandidate, VenueCandidate
from app.services.table_match_computation_context import TableMatchComputationContext
from app.services.table_match_hard_fit import (
    PlayerCandidateFacts,
    TimeWindow,
    evaluate_player_candidate,
    intersect_occurrences,
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
    """Return one deterministic eligible record per durable Player profile."""

    venue_point = GeoPoint(latitude=venue.latitude, longitude=venue.longitude)
    best_by_profile: dict[UUID, CompatiblePlayerOpportunity] = {}

    for player in players:
        if player.game_system_id != gm.game_system_id:
            continue
        if player.preferred_format not in {"any", gm.preferred_format}:
            continue

        occurrences = context.occurrences(player.rule, window_start, window_end)
        overlapping_occurrences = tuple(
            occurrence
            for occurrence in occurrences
            if intersect_occurrences(occurrence, table_overlap) is not None
        )
        if not overlapping_occurrences:
            continue

        distance_miles = context.distance_to_venue(
            player.postal_code,
            venue.venue_id,
            venue_point,
        )
        for occurrence in overlapping_occurrences:
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
                    decision.criterion for decision in evaluation.decisions if decision.passed
                ),
            )
            current = best_by_profile.get(player.player_profile_id)
            if current is None or _is_better_candidate(candidate, current):
                best_by_profile[player.player_profile_id] = candidate

    return tuple(best_by_profile[profile_id] for profile_id in sorted(best_by_profile, key=str))


def _is_better_candidate(
    candidate: CompatiblePlayerOpportunity,
    current: CompatiblePlayerOpportunity,
) -> bool:
    candidate_duration = candidate.overlap.end_at - candidate.overlap.start_at
    current_duration = current.overlap.end_at - current.overlap.start_at
    if candidate_duration != current_duration:
        return candidate_duration > current_duration
    if candidate.overlap.start_at != current.overlap.start_at:
        return candidate.overlap.start_at < current.overlap.start_at
    return str(candidate.demand_id) < str(current.demand_id)


__all__ = ["find_compatible_players"]
