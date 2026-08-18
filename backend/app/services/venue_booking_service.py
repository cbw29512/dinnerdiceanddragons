"""Verified Venue Manager booking approval and cancellation workflow."""

import logging
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.venue_booking_request import VenueBookingRequest, VenueBookingStatus
from app.models.venue_table_window import VenueTableWindow
from app.schemas.event_lifecycle import VenueBookingResponse
from app.services.event_access import load_event, require_verified_venue_manager
from app.services.event_lifecycle_state import synchronize_event_state
from app.services.venue_booking_capacity import (
    VenueCapacityConflictError,
    require_booking_capacity,
)

LOGGER = logging.getLogger(__name__)


class VenueBookingNotFoundError(LookupError):
    pass


class VenueBookingConflictError(RuntimeError):
    pass


class VenueBookingPersistenceError(RuntimeError):
    pass


def decide_venue_booking(
    session: Session,
    user: User,
    booking_id: UUID,
    action: str,
    message: str | None,
) -> VenueBookingResponse:
    """Apply one verified Venue Manager decision transactionally."""

    try:
        booking = session.scalar(
            select(VenueBookingRequest)
            .where(VenueBookingRequest.id == booking_id)
            .with_for_update()
        )
        if booking is None or booking.event_id is None:
            raise VenueBookingNotFoundError("Venue booking was not found.")
        event = load_event(session, booking.event_id, lock=True)
        require_verified_venue_manager(session, user, event)
        window = session.get(VenueTableWindow, booking.venue_table_window_id)
        if window is None or not window.active:
            raise VenueBookingConflictError("Venue table window is no longer available.")

        if action == "approve":
            if booking.status == VenueBookingStatus.APPROVED.value:
                return _response(booking)
            _require_transition(
                booking.status,
                {VenueBookingStatus.REQUESTED.value, VenueBookingStatus.QUESTION.value},
                "approved",
            )
            if event.max_players + 1 > window.max_people_per_table:
                raise VenueBookingConflictError(
                    "Venue table capacity no longer supports the Event headcount."
                )
            require_booking_capacity(session, booking, window)
            booking.status = VenueBookingStatus.APPROVED.value
        elif action == "question":
            _require_transition(
                booking.status,
                {VenueBookingStatus.REQUESTED.value, VenueBookingStatus.QUESTION.value},
                "questioned",
            )
            booking.status = VenueBookingStatus.QUESTION.value
        elif action == "decline":
            if booking.status == VenueBookingStatus.DECLINED.value:
                return _response(booking)
            _require_transition(
                booking.status,
                {VenueBookingStatus.REQUESTED.value, VenueBookingStatus.QUESTION.value},
                "declined",
            )
            booking.status = VenueBookingStatus.DECLINED.value
        elif action == "cancel":
            if booking.status == VenueBookingStatus.CANCELLED.value:
                return _response(booking)
            _require_transition(
                booking.status,
                {
                    VenueBookingStatus.REQUESTED.value,
                    VenueBookingStatus.QUESTION.value,
                    VenueBookingStatus.APPROVED.value,
                },
                "cancelled",
            )
            booking.status = VenueBookingStatus.CANCELLED.value
        else:
            raise VenueBookingConflictError("Unsupported Venue booking action.")

        if message is not None:
            booking.venue_message = message.strip() or None
        synchronize_event_state(session, event, booking)
        session.commit()
        return _response(booking)
    except (
        VenueBookingNotFoundError,
        VenueBookingConflictError,
        VenueCapacityConflictError,
    ):
        session.rollback()
        raise
    except SQLAlchemyError as exc:
        session.rollback()
        LOGGER.exception("Venue booking decision failed")
        raise VenueBookingPersistenceError(
            "Venue booking decision could not be persisted."
        ) from exc


def _require_transition(current: str, allowed: set[str], label: str) -> None:
    if current not in allowed:
        raise VenueBookingConflictError(f"Venue booking cannot be {label} from its current state.")


def _response(booking: VenueBookingRequest) -> VenueBookingResponse:
    return VenueBookingResponse(
        id=booking.id,
        event_id=booking.event_id,
        status=booking.status,
        expected_guests=booking.expected_guests,
        requested_start=booking.requested_start,
        requested_end=booking.requested_end,
        venue_message=booking.venue_message,
    )


__all__ = [
    "VenueBookingConflictError",
    "VenueBookingNotFoundError",
    "VenueBookingPersistenceError",
    "decide_venue_booking",
]
