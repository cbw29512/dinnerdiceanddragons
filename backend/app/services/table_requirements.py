"""Authoritative V1 formation-requirements logic for a persistent Table."""

from dataclasses import dataclass
import logging

from app.models.game_table import GameTable, TableLifecycleStatus

LOGGER = logging.getLogger(__name__)


class TableStateError(ValueError):
    """Raised when a requested Table lifecycle transition violates domain rules."""


@dataclass(frozen=True, slots=True)
class TableRequirements:
    """Formation gaps kept separate from the Table lifecycle state."""

    needs_gm: bool
    open_player_seats: int
    minimum_players_missing: int
    needs_venue: bool
    needs_venue_approval: bool
    needs_schedule: bool
    ready_to_confirm: bool


def evaluate_table_requirements(
    game_table: GameTable,
    *,
    committed_players: int,
    has_schedule: bool,
    venue_approval_required: bool = False,
    venue_approved: bool = False,
) -> TableRequirements:
    """Return deterministic formation gaps from authoritative Table inputs.

    Membership and Session persistence are intentionally not required by this
    first slice. Their services will supply the committed-player count and
    schedule/approval facts when those aggregates are added.
    """

    try:
        if committed_players < 0:
            raise ValueError("committed_players cannot be negative")
        if committed_players > game_table.maximum_players:
            raise ValueError("committed_players cannot exceed maximum_players")
        if game_table.minimum_players < 1:
            raise ValueError("minimum_players must be at least 1")
        if game_table.maximum_players < game_table.minimum_players:
            raise ValueError("maximum_players cannot be below minimum_players")

        needs_gm = game_table.gm_profile_id is None
        needs_venue = game_table.venue_id is None
        open_player_seats = game_table.maximum_players - committed_players
        minimum_players_missing = max(0, game_table.minimum_players - committed_players)
        needs_schedule = not has_schedule
        needs_venue_approval = (
            not needs_venue and venue_approval_required and not venue_approved
        )

        ready_to_confirm = not any(
            (
                needs_gm,
                minimum_players_missing > 0,
                needs_venue,
                needs_venue_approval,
                needs_schedule,
            )
        )

        return TableRequirements(
            needs_gm=needs_gm,
            open_player_seats=open_player_seats,
            minimum_players_missing=minimum_players_missing,
            needs_venue=needs_venue,
            needs_venue_approval=needs_venue_approval,
            needs_schedule=needs_schedule,
            ready_to_confirm=ready_to_confirm,
        )
    except Exception:
        LOGGER.exception(
            "Failed to evaluate Table requirements table_id=%s committed_players=%s",
            getattr(game_table, "id", None),
            committed_players,
        )
        raise


def transition_table_to_ready(
    game_table: GameTable,
    requirements: TableRequirements,
) -> GameTable:
    """Move a FORMING Table to READY only when no formation requirement remains."""

    try:
        if game_table.lifecycle_status != TableLifecycleStatus.FORMING.value:
            raise TableStateError("Only a forming Table can transition to ready")
        if not requirements.ready_to_confirm:
            raise TableStateError("Table still has unmet formation requirements")

        game_table.lifecycle_status = TableLifecycleStatus.READY.value
        return game_table
    except Exception:
        LOGGER.exception(
            "Failed Table transition to ready table_id=%s status=%s",
            getattr(game_table, "id", None),
            getattr(game_table, "lifecycle_status", None),
        )
        raise
