"""Reconcile persistent GameTable state from authoritative Event state."""

import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.event import Event, EventStatus
from app.models.game_table import GameTable, GameTableStatus
from app.models.venue_booking_request import VenueBookingRequest, VenueBookingStatus
from app.services.game_table_requirement_state import (
    GameTableRequirements,
    transition_game_table_to_ready,
)
from app.services.game_table_requirements import evaluate_game_table_requirements

LOGGER = logging.getLogger(__name__)
CONFIRMED_EVENT_STATUSES = {
    EventStatus.CONFIRMED.value,
    EventStatus.FULL.value,
}
TABLE_STATES_NOT_RECONCILED_FROM_ONE_EVENT = {
    GameTableStatus.IN_PROGRESS.value,
    GameTableStatus.COMPLETED.value,
    GameTableStatus.CANCELLED.value,
    GameTableStatus.ARCHIVED.value,
}


def synchronize_game_table_from_event(
    session: Session,
    event: Event,
    booking: VenueBookingRequest,
) -> None:
    """Promote or safely reopen a Table from its aggregate Event state."""

    try:
        if event.game_table_id is None:
            return

        game_table = session.scalar(
            select(GameTable).where(GameTable.id == event.game_table_id).with_for_update()
        )
        if game_table is None:
            raise RuntimeError("Event references a missing persistent GameTable.")
        if game_table.lifecycle_status in TABLE_STATES_NOT_RECONCILED_FROM_ONE_EVENT:
            return

        requirements = evaluate_game_table_requirements(
            session,
            game_table,
            venue_approved=booking.status == VenueBookingStatus.APPROVED.value,
        )
        if event.status in CONFIRMED_EVENT_STATUSES:
            _promote_confirmed_table(game_table, event, requirements)
            return

        if _has_established_or_other_confirmed_event(session, event):
            return

        game_table.lifecycle_status = (
            GameTableStatus.READY.value
            if requirements.ready_to_confirm
            else GameTableStatus.FORMING.value
        )
    except Exception:
        LOGGER.exception(
            "Failed to synchronize GameTable from Event event_id=%s table_id=%s",
            event.id,
            event.game_table_id,
        )
        raise


def _promote_confirmed_table(
    game_table: GameTable,
    event: Event,
    requirements: GameTableRequirements,
) -> None:
    if not requirements.ready_to_confirm:
        LOGGER.warning(
            "Confirmed Event has unmet GameTable requirements event_id=%s table_id=%s",
            event.id,
            game_table.id,
        )
        return
    if game_table.lifecycle_status == GameTableStatus.FORMING.value:
        transition_game_table_to_ready(game_table, requirements)
    if game_table.lifecycle_status == GameTableStatus.READY.value:
        game_table.lifecycle_status = GameTableStatus.CONFIRMED.value


def _has_established_or_other_confirmed_event(session: Session, event: Event) -> bool:
    other_event_id = session.scalar(
        select(Event.id)
        .where(
            Event.game_table_id == event.game_table_id,
            Event.id != event.id,
            Event.status.in_(
                {
                    EventStatus.CONFIRMED.value,
                    EventStatus.FULL.value,
                    EventStatus.COMPLETED.value,
                }
            ),
        )
        .limit(1)
    )
    completed_current_event = event.status == EventStatus.COMPLETED.value
    return completed_current_event or other_event_id is not None


__all__ = ["synchronize_game_table_from_event"]
