"""Serializable Venue-capacity checks shared by manual and automatic approval."""

from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.venue import Venue
from app.models.venue_booking_request import VenueBookingRequest, VenueBookingStatus
from app.models.venue_table_window import VenueTableWindow


class VenueCapacityConflictError(RuntimeError):
    """The requested booking would exceed physical Venue table supply."""


@dataclass(frozen=True, slots=True)
class CapacitySnapshot:
    capacity_tables: int
    already_reserved_tables: int


def require_booking_capacity(
    session: Session,
    booking: VenueBookingRequest,
    window: VenueTableWindow,
) -> CapacitySnapshot:
    """Lock the Venue and reject overlapping reservations beyond table supply."""

    if not window.active:
        raise VenueCapacityConflictError("Venue table availability is no longer active.")

    venue = session.scalar(
        select(Venue).where(Venue.id == window.venue_id).with_for_update()
    )
    if venue is None or not venue.active or not venue.verified:
        raise VenueCapacityConflictError("Venue is no longer available for booking.")

    overlapping = session.execute(
        select(VenueBookingRequest, VenueTableWindow)
        .join(
            VenueTableWindow,
            VenueTableWindow.id == VenueBookingRequest.venue_table_window_id,
        )
        .where(
            VenueTableWindow.venue_id == window.venue_id,
            VenueBookingRequest.id != booking.id,
            VenueBookingRequest.status == VenueBookingStatus.APPROVED.value,
            VenueBookingRequest.requested_start < booking.requested_end,
            VenueBookingRequest.requested_end > booking.requested_start,
        )
    ).all()

    capacity = min(
        [window.table_count, *(other_window.table_count for _, other_window in overlapping)]
    )
    already_reserved = sum(other.tables_requested for other, _ in overlapping)
    if already_reserved + booking.tables_requested > capacity:
        raise VenueCapacityConflictError(
            "Venue table capacity is already reserved for an overlapping time."
        )

    return CapacitySnapshot(
        capacity_tables=capacity,
        already_reserved_tables=already_reserved,
    )


__all__ = ["CapacitySnapshot", "VenueCapacityConflictError", "require_booking_capacity"]
