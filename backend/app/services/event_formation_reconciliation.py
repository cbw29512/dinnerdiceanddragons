"""Shared Event/headcount reconciliation for table-formation transactions."""

from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.event import Event, EventStatus
from app.models.registration import Registration, RegistrationStatus
from app.models.venue_booking_request import VenueBookingRequest, VenueBookingStatus
from app.services.event_registration_access import require_player_profile_eligible
from app.services.table_formation_errors import (
    TableFormationConflictError,
    TableFormationForbiddenError,
    TableFormationNotFoundError,
)

TERMINAL_EVENT_STATUSES = {
    EventStatus.CANCELLED.value,
    EventStatus.COMPLETED.value,
}


def reconcile_event_formation(
    session: Session,
    *,
    event: Event,
    booking: VenueBookingRequest,
) -> int:
    """Update expected guests and derived Event lifecycle; return confirmed seats."""

    if booking.event_id != event.id:
        raise TableFormationConflictError("Venue booking does not belong to the Event.")

    confirmed_count = _confirmed_count(session, event.id)
    booking.expected_guests = 1 + confirmed_count

    if event.status in TERMINAL_EVENT_STATUSES:
        return confirmed_count

    if booking.status in {
        VenueBookingStatus.DECLINED.value,
        VenueBookingStatus.CANCELLED.value,
    }:
        event.status = EventStatus.CANCELLED.value
    elif booking.status in {
        VenueBookingStatus.REQUESTED.value,
        VenueBookingStatus.QUESTION.value,
    }:
        event.status = EventStatus.VENUE_REQUESTED.value
    elif booking.status == VenueBookingStatus.APPROVED.value:
        if confirmed_count >= event.max_players:
            event.status = EventStatus.FULL.value
        elif confirmed_count >= event.min_players:
            event.status = EventStatus.CONFIRMED.value
        else:
            event.status = EventStatus.FORMING.value
    else:
        raise TableFormationConflictError("Venue booking has an unsupported lifecycle state.")

    return confirmed_count


def promote_next_waitlisted_registration(
    session: Session,
    *,
    event: Event,
) -> Registration | None:
    """Promote the earliest currently eligible waitlisted Player when a seat opens."""

    if _confirmed_count(session, event.id) >= event.max_players:
        return None

    waitlisted = session.scalars(
        select(Registration)
        .where(
            Registration.event_id == event.id,
            Registration.status == RegistrationStatus.WAITLISTED.value,
        )
        .order_by(Registration.requested_at, Registration.id)
        .with_for_update()
    ).all()
    for registration in waitlisted:
        try:
            require_player_profile_eligible(
                session,
                event=event,
                player_profile_id=registration.player_profile_id,
            )
        except (TableFormationForbiddenError, TableFormationNotFoundError):
            continue
        registration.status = RegistrationStatus.CONFIRMED.value
        registration.responded_at = datetime.now(UTC)
        registration.cancelled_at = None
        return registration
    return None


def _confirmed_count(session: Session, event_id) -> int:
    return int(
        session.scalar(
            select(func.count())
            .select_from(Registration)
            .where(
                Registration.event_id == event_id,
                Registration.status == RegistrationStatus.CONFIRMED.value,
            )
        )
        or 0
    )


__all__ = ["promote_next_waitlisted_registration", "reconcile_event_formation"]
