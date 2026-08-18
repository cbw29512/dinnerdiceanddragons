"""Shared registration lifecycle errors and response mapping."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.registration import Registration
from app.schemas.event_lifecycle import RegistrationResponse


class RegistrationNotFoundError(LookupError):
    pass


class RegistrationConflictError(RuntimeError):
    pass


class RegistrationPersistenceError(RuntimeError):
    pass


def load_registration(
    session: Session,
    registration_id: UUID,
    *,
    event_id: UUID | None = None,
    lock: bool = False,
) -> Registration:
    query = select(Registration).where(Registration.id == registration_id)
    if event_id is not None:
        query = query.where(Registration.event_id == event_id)
    if lock:
        query = query.with_for_update()
    registration = session.scalar(query)
    if registration is None:
        raise RegistrationNotFoundError("Registration was not found.")
    return registration


def registration_response(registration: Registration) -> RegistrationResponse:
    return RegistrationResponse(
        id=registration.id,
        event_id=registration.event_id,
        status=registration.status,
        expectations_acknowledged_at=registration.expectations_acknowledged_at,
        requested_at=registration.requested_at,
        responded_at=registration.responded_at,
        cancelled_at=registration.cancelled_at,
    )


__all__ = [
    "RegistrationConflictError",
    "RegistrationNotFoundError",
    "RegistrationPersistenceError",
    "load_registration",
    "registration_response",
]
