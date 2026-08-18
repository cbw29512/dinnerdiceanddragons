"""Computed, not-yet-persisted Table Match opportunity values."""

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from app.services.table_match_hard_fit import CriterionDecision, TimeWindow


@dataclass(frozen=True, slots=True)
class CompatiblePlayerOpportunity:
    """One Player demand signal that passed every current hard-fit rule."""

    demand_id: UUID
    distance_miles: float
    overlap: TimeWindow
    fit_flags: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class MatchOpportunity:
    """One complete GM + Venue occurrence with enough compatible Players."""

    gm_supply_signal_id: UUID
    venue_table_window_id: UUID
    game_system_id: UUID
    proposed_start: datetime
    proposed_end: datetime
    timezone: str
    minimum_players: int
    maximum_players: int
    gm_distance_miles: float
    players: tuple[CompatiblePlayerOpportunity, ...]
    explanations: tuple[CriterionDecision, ...]

    @property
    def compatible_player_count(self) -> int:
        return len(self.players)

    @property
    def distance_summary(self) -> dict[str, object]:
        player_distances = [player.distance_miles for player in self.players]
        return {
            "distance_type": "approximate_straight_line",
            "gm_miles": round(self.gm_distance_miles, 2),
            "nearest_player_miles": round(min(player_distances), 2),
            "furthest_player_miles": round(max(player_distances), 2),
        }


__all__ = ["CompatiblePlayerOpportunity", "MatchOpportunity"]
