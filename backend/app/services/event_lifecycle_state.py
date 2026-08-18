"""Server-side Event state derived from Venue approval and confirmed seats."""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.event import Event, EventStatus
from app.models.registration import Registration, RegistrationStatus
from app.models.venue_booking_request import VenueBookingRequest, VenueBookingStatus


class EventLifecycleConflictError(RuntimeError):
    pass


def booking_for_event(
    session: Session,
    event_id,
    *,
    lock: bool = False,
) -> VenueBookingRequest:
    query = select(VenueBookingRequest).where(VenueBookingRequest.event_id == event_id)
    if lock:
        query = query.with_for_update()
    booking = session.scalar(query)
    if booking is None:
        raise EventLifecycleConflictError("Event is missing Venue booking state.")
    return booking


def confirmed_registration_count(session: Session, event_id) -> int:
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


def synchronize_event_state(
    session: Session,
    event: Event,
    booking: VenueBookingRequest | None = None,
) -> int:
    """Update headcount and Event lifecycle from authoritative persisted state."""

    # Production sessions intentionally use autoflush=False. Lifecycle state must
    # therefore flush pending registration mutations before issuing count queries.
    session.flush()
    booking = booking or booking_for_event(session, event.id)
    confirmed = confirmed_registration_count(session, event.id)
    booking.expected_guests = 1 + confirmed

    if event.status == EventStatus.COMPLETED.value:
        return confirmed
    if booking.status in {
        VenueBookingStatus.DECLINED.value,
        VenueBookingStatus.CANCELLED.value,
    }:
        event.status = EventStatus.CANCELLED.value
        return confirmed
    if booking.status != VenueBookingStatus.APPROVED.value:
        event.status = EventStatus.VENUE_REQUESTED.value
        return confirmed

    if confirmed >= event.max_players:
        event.status = EventStatus.FULL.value
    elif confirmed >= event.min_players:
        event.status = EventStatus.CONFIRMED.value
    else:
        event.status = EventStatus.FORMING.value
    return confirmed


__all__ = [
    "EventLifecycleConflictError",
    "booking_for_event",
    "confirmed_registration_count",
    "synchronize_event_state",
]
