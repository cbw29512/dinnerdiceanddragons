"""Persistence adapter for authoritative GameTable formation requirements."""

import logging

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.game_table import GameTable
from app.models.game_table_player import GameTablePlayer, GameTablePlayerStatus
from app.models.venue_table_window import VenueTableWindow
from app.services.game_table_requirement_state import (
    GameTableRequirements,
    GameTableRequirementsError,
    evaluate_requirements_snapshot,
)

LOGGER = logging.getLogger(__name__)


def evaluate_game_table_requirements(
    session: Session,
    game_table: GameTable,
    *,
    venue_approved: bool = False,
) -> GameTableRequirements:
    """Load persisted membership/Venue facts and calculate current requirements."""

    try:
        session.flush()
        confirmed_players = int(
            session.scalar(
                select(func.count())
                .select_from(GameTablePlayer)
                .where(
                    GameTablePlayer.game_table_id == game_table.id,
                    GameTablePlayer.status == GameTablePlayerStatus.CONFIRMED.value,
                )
            )
            or 0
        )

        approval_required = False
        if game_table.venue_table_window_id is not None:
            window = session.get(VenueTableWindow, game_table.venue_table_window_id)
            if window is None:
                raise GameTableRequirementsError("Selected Venue table window no longer exists.")
            if game_table.venue_id is not None and window.venue_id != game_table.venue_id:
                raise GameTableRequirementsError(
                    "Selected Venue table window belongs to a different Venue."
                )
            approval_required = bool(window.approval_required)

        return evaluate_requirements_snapshot(
            game_table,
            confirmed_players=confirmed_players,
            venue_approval_required=approval_required,
            venue_approved=venue_approved,
        )
    except Exception:
        LOGGER.exception(
            "Failed to evaluate persisted GameTable requirements table_id=%s",
            getattr(game_table, "id", None),
        )
        raise


__all__ = ["evaluate_game_table_requirements"]
