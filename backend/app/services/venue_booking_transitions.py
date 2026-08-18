"""Verified Venue Manager transitions with row-locked capacity protection."""

import logging
from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.event import Event
from app.models.venue_booking_request import VenueBookingRequest, VenueBookingStatus
from app.models.venue_table_window import VenueTableWindow
from app.services.event_formation_reconciliation import reconcile_event_formation
from app.services.table_formation_errors import (
    TableFormationConflictError,
    TableFormationError,
    TableFormationNotFoundError,
)
from app.services.venue_booking_policy import (
    require_available_table_capacity,
    require_verified_venue_manager,
)

LOGGER = logging.getLogger(__name__)
ALLOWED_BOOKING_TRANSITIONS = {
    VenueBookingStatus.REQUESTED.value: {
        VenueBookingStatus.QUESTION.value,
        VenueBookingStatus.APPROVED.value,
        VenueBookingStatus.DECLINED.value,
        VenueBookingStatus.CANCELLED.value,
    },
    VenueBookingStatus.QUESTION.value: {
        VenueBookingStatus.APPROVED.value,
        VenueBookingStatus.DECLINED.value,
        VenueBookingStatus.CANCELLED.value,
    },
    VenueBookingStatus.APPROVED.value: {VenueBookingStatus.CANCELLED.value},
    VenueBookingStatus.DECLINED.value: set(),
    VenueBookingStatus.CANCELLED.value: set(),
}


@dataclass(frozen=True, slots=True)
class VenueBookingTransitionResult:
    """Public-safe result of one Venue booking lifecycle transition."""

    booking_id: UUID
    event_id: UUID
    status: str
    event_status: str
    expected_guests: int


def transition_venue_booking(
    session: Session,
    *,
    booking_id: UUID,
    caller_user_id: UUID,
    target_status: str,
    venue_message: str | None = None,
) -> VenueBookingTransitionResult:
    """Apply one authorized Venue transition without exceeding physical table supply."""

    try:
        booking = session.scalar(
            select(VenueBookingRequest)
            .where(VenueBookingRequest.id == booking_id)
            .with_for_update()
        )
        if booking is None or booking.event_id is None:
            raise TableFormationNotFoundError("Venue booking is not available.")

        window = session.scalar(
            select(VenueTableWindow)
            .where(VenueTableWindow.id == booking.venue_table_window_id)
            .with_for_update()
        )
        if window is None:
            raise TableFormationNotFoundError("Venue booking is not available.")
        require_verified_venue_manager(
            session,
            user_id=caller_user_id,
            venue_id=window.venue_id,
        )

        event = session.scalar(
            select(Event).where(Event.id == booking.event_id).with_for_update()
        )
        if event is None:
            raise TableFormationNotFoundError("Venue booking is not available.")

        _apply_transition(session, booking, window, target_status)
        if venue_message is not None:
            normalized = venue_message.strip()
            booking.venue_message = normalized or None

        reconcile_event_formation(session, event=event, booking=booking)
        session.commit()
        return VenueBookingTransitionResult(
            booking_id=booking.id,
            event_id=event.id,
            status=booking.status,
            event_status=event.status,
            expected_guests=booking.expected_guests,
        )
    except TableFormationError:
        session.rollback()
        raise
    except Exception:
        session.rollback()
        LOGGER.exception("Venue booking transition failed")
        raise


def _apply_transition(
    session: Session,
    booking: VenueBookingRequest,
    window: VenueTableWindow,
    target_status: str,
) -> None:
    if target_status not in {status.value for status in VenueBookingStatus}:
        raise TableFormationConflictError("Unsupported Venue booking status.")
    if target_status == booking.status:
        return

    allowed = ALLOWED_BOOKING_TRANSITIONS.get(booking.status, set())
    if target_status not in allowed:
        raise TableFormationConflictError("Venue booking transition is not allowed.")
    if target_status == VenueBookingStatus.APPROVED.value:
        require_available_table_capacity(session, booking=booking, window=window)
    booking.status = target_status


__all__ = ["VenueBookingTransitionResult", "transition_venue_booking"]
