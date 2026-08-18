"""Pure state logic for persistent GameTable formation requirements."""

import logging
from dataclasses import dataclass

from app.models.game_table import GameTable, GameTableStatus

LOGGER = logging.getLogger(__name__)


class GameTableRequirementsError(RuntimeError):
    """Raised when a Table snapshot cannot produce valid requirements."""


class GameTableTransitionError(RuntimeError):
    """Raised when a lifecycle transition violates Table formation rules."""


@dataclass(frozen=True, slots=True)
class GameTableRequirements:
    """Missing resources for one Table, independent of lifecycle status."""

    needs_gm: bool
    open_player_seats: int
    minimum_players_missing: int
    needs_venue: bool
    needs_venue_approval: bool
    needs_schedule: bool
    ready_to_confirm: bool


def evaluate_requirements_snapshot(
    game_table: GameTable,
    *,
    confirmed_players: int,
    venue_approval_required: bool,
    venue_approved: bool,
) -> GameTableRequirements:
    """Calculate requirements from already-authoritative snapshot values."""

    try:
        if confirmed_players < 0:
            raise GameTableRequirementsError("Confirmed Player count cannot be negative.")
        if confirmed_players > game_table.maximum_players:
            raise GameTableRequirementsError("Confirmed Players exceed Table capacity.")
        if game_table.minimum_players < 1:
            raise GameTableRequirementsError("Table minimum Players must be at least one.")
        if game_table.maximum_players < game_table.minimum_players:
            raise GameTableRequirementsError("Table maximum Players cannot be below minimum.")

        needs_gm = game_table.gm_profile_id is None
        needs_venue = game_table.venue_id is None
        needs_schedule = not all(
            (game_table.proposed_start, game_table.proposed_end, game_table.timezone)
        )
        open_player_seats = game_table.maximum_players - confirmed_players
        minimum_players_missing = max(0, game_table.minimum_players - confirmed_players)
        needs_venue_approval = bool(
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

        return GameTableRequirements(
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
            "Failed to evaluate GameTable requirement snapshot table_id=%s",
            getattr(game_table, "id", None),
        )
        raise


def transition_game_table_to_ready(
    game_table: GameTable,
    requirements: GameTableRequirements,
) -> GameTable:
    """Move a forming Table to READY only after every requirement is satisfied."""

    try:
        if game_table.lifecycle_status != GameTableStatus.FORMING.value:
            raise GameTableTransitionError("Only a forming Table can transition to ready.")
        if not requirements.ready_to_confirm:
            raise GameTableTransitionError("Table still has unmet formation requirements.")

        game_table.lifecycle_status = GameTableStatus.READY.value
        return game_table
    except Exception:
        LOGGER.exception(
            "Failed GameTable transition to ready table_id=%s status=%s",
            getattr(game_table, "id", None),
            getattr(game_table, "lifecycle_status", None),
        )
        raise


__all__ = [
    "GameTableRequirements",
    "GameTableRequirementsError",
    "GameTableTransitionError",
    "evaluate_requirements_snapshot",
    "transition_game_table_to_ready",
]
