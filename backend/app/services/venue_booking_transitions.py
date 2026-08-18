"""Verified Venue Manager transitions with row-locked capacity protection."""

import logging
from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.event import Event
from app.models.user import AccountStatus, User
from app.models.user_role import UserRole, UserRoleType
from app.models.venue import VenueManager
from app.models.venue_booking_request import VenueBookingRequest, VenueBookingStatus
from app.models.venue_table_window import VenueTableWindow
from app.services.event_formation_reconciliation import reconcile_event_formation
from app.services.table_formation_errors import (
    TableFormationConflictError,
    TableFormationError,
    TableFormationForbiddenError,
    TableFormationNotFoundError,
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
        _require_verified_manager(session, caller_user_id, window.venue_id)

        event = session.scalar(
            select(Event).where(Event.id == booking.event_id).with_for_update()
        )
        if event is None:
            raise TableFormationNotFoundError("Venue booking is not available.")

        if target_status not in {status.value for status in VenueBookingStatus}:
            raise TableFormationConflictError("Unsupported Venue booking status.")
        if target_status != booking.status:
            allowed = ALLOWED_BOOKING_TRANSITIONS.get(booking.status, set())
            if target_status not in allowed:
                raise TableFormationConflictError("Venue booking transition is not allowed.")
            if target_status == VenueBookingStatus.APPROVED.value:
                _require_available_table_capacity(session, booking, window)
            booking.status = target_status

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


def _require_verified_manager(session: Session, user_id: UUID, venue_id: UUID) -> None:
    active_user = session.scalar(
        select(User.id).where(
            User.id == user_id,
            User.status == AccountStatus.ACTIVE.value,
        )
    )
    role_exists = session.scalar(
        select(UserRole.user_id).where(
            UserRole.user_id == user_id,
            UserRole.role == UserRoleType.VENUE_MANAGER.value,
        )
    )
    manager_exists = session.scalar(
        select(VenueManager.id).where(
            VenueManager.user_id == user_id,
            VenueManager.venue_id == venue_id,
            VenueManager.verified_at.is_not(None),
        )
    )
    if active_user is None or role_exists is None or manager_exists is None:
        raise TableFormationForbiddenError("Verified Venue Manager access is required.")


def _require_available_table_capacity(
    session: Session,
    booking: VenueBookingRequest,
    window: VenueTableWindow,
) -> None:
    if booking.tables_requested > window.table_count:
        raise TableFormationConflictError("Requested tables exceed Venue table supply.")

    approved_tables = int(
        session.scalar(
            select(func.coalesce(func.sum(VenueBookingRequest.tables_requested), 0)).where(
                VenueBookingRequest.venue_table_window_id == window.id,
                VenueBookingRequest.status == VenueBookingStatus.APPROVED.value,
                VenueBookingRequest.id != booking.id,
                VenueBookingRequest.requested_start < booking.requested_end,
                VenueBookingRequest.requested_end > booking.requested_start,
            )
        )
        or 0
    )
    if approved_tables + booking.tables_requested > window.table_count:
        raise TableFormationConflictError("Venue table capacity is already reserved for this time.")


__all__ = ["VenueBookingTransitionResult", "transition_venue_booking"]
