"""Deterministic Venue table-count allocation for hard-fit opportunities."""

from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID

from app.services.table_match_engine_policy import prefer_opportunity
from app.services.table_match_opportunity import MatchOpportunity


@dataclass(frozen=True, slots=True)
class VenueOccurrenceCandidate:
    """One qualified match competing for a physical table in a Venue occurrence."""

    opportunity: MatchOpportunity
    venue_occurrence_start: datetime
    venue_occurrence_end: datetime
    table_count: int

    @property
    def allocation_key(self) -> tuple[UUID, datetime, datetime]:
        return (
            self.opportunity.venue_table_window_id,
            self.venue_occurrence_start.astimezone(UTC),
            self.venue_occurrence_end.astimezone(UTC),
        )


def allocate_venue_tables(
    candidates: list[VenueOccurrenceCandidate],
) -> tuple[MatchOpportunity, ...]:
    """Cap each Venue occurrence at its declared simultaneous table count."""

    groups: dict[
        tuple[UUID, datetime, datetime],
        list[VenueOccurrenceCandidate],
    ] = {}
    for candidate in candidates:
        groups.setdefault(candidate.allocation_key, []).append(candidate)

    selected: dict[tuple[object, ...], MatchOpportunity] = {}
    for allocation_key in sorted(groups, key=lambda key: (str(key[0]), key[1], key[2])):
        group = groups[allocation_key]
        table_count = min(candidate.table_count for candidate in group)
        best_per_gm = _best_per_gm(group)
        ranked = sorted(
            best_per_gm.values(),
            key=lambda candidate: (
                -candidate.opportunity.compatible_player_count,
                str(candidate.opportunity.gm_supply_signal_id),
                candidate.opportunity.proposed_start,
                candidate.opportunity.proposed_end,
            ),
        )
        for candidate in ranked[:table_count]:
            opportunity = candidate.opportunity
            key = _match_key(opportunity)
            current = selected.get(key)
            if current is None or prefer_opportunity(opportunity, current):
                selected[key] = opportunity

    return tuple(
        selected[key]
        for key in sorted(
            selected,
            key=lambda key: (str(key[0]), str(key[1]), key[2], key[3]),
        )
    )


def _best_per_gm(
    group: list[VenueOccurrenceCandidate],
) -> dict[UUID, VenueOccurrenceCandidate]:
    best: dict[UUID, VenueOccurrenceCandidate] = {}
    for candidate in group:
        gm_id = candidate.opportunity.gm_supply_signal_id
        current = best.get(gm_id)
        if current is None or prefer_opportunity(candidate.opportunity, current.opportunity):
            best[gm_id] = candidate
    return best


def _match_key(opportunity: MatchOpportunity) -> tuple[object, ...]:
    return (
        opportunity.gm_supply_signal_id,
        opportunity.venue_table_window_id,
        opportunity.proposed_start,
        opportunity.proposed_end,
    )


__all__ = ["VenueOccurrenceCandidate", "allocate_venue_tables"]
