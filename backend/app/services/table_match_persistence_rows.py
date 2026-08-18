"""Derived ORM child rows for persisted Table Match opportunities."""

from decimal import Decimal
from uuid import UUID

from app.models.match_explanation import MatchCriterionResult, MatchExplanation
from app.models.table_match_player import TableMatchPlayer
from app.services.table_match_opportunity import MatchOpportunity


def build_player_rows(
    match_id: UUID,
    opportunity: MatchOpportunity,
) -> list[TableMatchPlayer]:
    """Create one derived compatibility row per eligible Player demand signal."""

    return [
        TableMatchPlayer(
            table_match_id=match_id,
            player_demand_signal_id=player.demand_id,
            fit_flags=list(player.fit_flags),
            distance_miles=Decimal(f"{player.distance_miles:.2f}"),
            availability_overlap={
                "start": player.overlap.start_at.isoformat(),
                "end": player.overlap.end_at.isoformat(),
            },
        )
        for player in opportunity.players
    ]


def build_explanation_rows(
    match_id: UUID,
    opportunity: MatchOpportunity,
) -> list[MatchExplanation]:
    """Create deterministic human-readable hard-fit explanation rows."""

    return [
        MatchExplanation(
            table_match_id=match_id,
            criterion=decision.criterion,
            result=MatchCriterionResult.PASS.value,
            summary=decision.summary,
        )
        for decision in opportunity.explanations
    ]


__all__ = ["build_explanation_rows", "build_player_rows"]
