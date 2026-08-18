"""Shared locked state and response values for registration transactions."""

from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.event import Event
from app.models.registration import Registration, RegistrationStatus
from app.models.venue_booking_request import VenueBookingRequest
from app.services.table_formation_errors import TableFormationNotFoundError


@dataclass(frozen=True, slots=True)
class RegistrationMutationResult:
    """Public-safe result after a seat lifecycle mutation."""

    registration_id: UUID
    status: str
    event_status: str
    expected_guests: int


def locked_event_and_booking(
    session: Session,
    event_id: UUID,
) -> tuple[Event, VenueBookingRequest]:
    """Lock the Event serialization row and its one booking row."""

    event = session.scalar(select(Event).where(Event.id == event_id).with_for_update())
    if event is None:
        raise TableFormationNotFoundError("Event is not available.")
    booking = session.scalar(
        select(VenueBookingRequest)
        .where(VenueBookingRequest.event_id == event.id)
        .with_for_update()
    )
    if booking is None:
        raise TableFormationNotFoundError("Event is not available.")
    return event, booking


def confirmed_count(session: Session, event_id: UUID) -> int:
    """Return the number of currently confirmed Player seats."""

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


def mutation_result(
    registration: Registration,
    event: Event,
    booking: VenueBookingRequest,
) -> RegistrationMutationResult:
    return RegistrationMutationResult(
        registration_id=registration.id,
        status=registration.status,
        event_status=event.status,
        expected_guests=booking.expected_guests,
    )


__all__ = [
    "RegistrationMutationResult",
    "confirmed_count",
    "locked_event_and_booking",
    "mutation_result",
]
