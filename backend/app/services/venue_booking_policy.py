"""Authorization and physical-capacity policy for Venue booking transitions."""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.user import AccountStatus, User
from app.models.user_role import UserRole, UserRoleType
from app.models.venue import VenueManager
from app.models.venue_booking_request import VenueBookingRequest, VenueBookingStatus
from app.models.venue_table_window import VenueTableWindow
from app.services.table_formation_errors import (
    TableFormationConflictError,
    TableFormationForbiddenError,
)


def require_verified_venue_manager(
    session: Session,
    *,
    user_id: UUID,
    venue_id: UUID,
) -> None:
    """Require an active account, durable role, and verified relationship to the Venue."""

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


def require_available_table_capacity(
    session: Session,
    *,
    booking: VenueBookingRequest,
    window: VenueTableWindow,
) -> None:
    """Reject approval when overlapping approved bookings exhaust physical tables."""

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


__all__ = ["require_available_table_capacity", "require_verified_venue_manager"]
