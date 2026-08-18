"""Player-owned Event registration request and cancellation workflow."""

import logging
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.models.event import EventJoinMode, EventStatus
from app.models.registration import Registration, RegistrationStatus
from app.models.user import User
from app.schemas.event_lifecycle import RegistrationResponse
from app.services.event_access import (
    EventForbiddenError,
    load_event,
    player_is_matched,
    require_player_profile,
)
from app.services.event_lifecycle_state import (
    booking_for_event,
    confirmed_registration_count,
    synchronize_event_state,
)
from app.services.registration_common import (
    RegistrationConflictError,
    RegistrationNotFoundError,
    RegistrationPersistenceError,
    registration_response,
)
from app.services.registration_waitlist import promote_waitlist

LOGGER = logging.getLogger(__name__)
ACTIVE_REGISTRATION_STATUSES = {
    RegistrationStatus.REQUESTED.value,
    RegistrationStatus.CONFIRMED.value,
    RegistrationStatus.WAITLISTED.value,
}


def request_registration(
    session: Session,
    user: User,
    event_id: UUID,
) -> RegistrationResponse:
    """Create or idempotently return the caller's matched Player registration."""

    try:
        event = load_event(session, event_id, lock=True)
        if event.status in {EventStatus.CANCELLED.value, EventStatus.COMPLETED.value}:
            raise RegistrationConflictError("Event is not accepting registrations.")
        profile = require_player_profile(session, user)
        if not player_is_matched(session, event, profile):
            raise EventForbiddenError("This Player is not eligible for the matched table.")

        registration = session.scalar(
            select(Registration)
            .where(
                Registration.event_id == event.id,
                Registration.player_profile_id == profile.id,
            )
            .with_for_update()
        )
        if registration is not None and registration.status in ACTIVE_REGISTRATION_STATUSES:
            return registration_response(registration)
        if registration is not None and registration.status in {
            RegistrationStatus.DECLINED.value,
            RegistrationStatus.REMOVED.value,
        }:
            raise RegistrationConflictError(
                "Registration cannot be reopened after a GM decision."
            )

        confirmed = confirmed_registration_count(session, event.id)
        status = _initial_status(event.join_mode, confirmed, event.max_players)
        now = datetime.now(UTC)
        if registration is None:
            registration = Registration(
                event_id=event.id,
                player_profile_id=profile.id,
                status=status,
                expectations_acknowledged_at=now,
                requested_at=now,
                responded_at=(
                    now if status == RegistrationStatus.CONFIRMED.value else None
                ),
            )
            session.add(registration)
        else:
            registration.status = status
            registration.expectations_acknowledged_at = now
            registration.requested_at = now
            registration.responded_at = (
                now if status == RegistrationStatus.CONFIRMED.value else None
            )
            registration.cancelled_at = None

        booking = booking_for_event(session, event.id, lock=True)
        synchronize_event_state(session, event, booking)
        session.commit()
        return registration_response(registration)
    except (EventForbiddenError, RegistrationConflictError):
        session.rollback()
        raise
    except SQLAlchemyError as exc:
        session.rollback()
        LOGGER.exception("Player registration request failed")
        raise RegistrationPersistenceError(
            "Registration could not be persisted."
        ) from exc


def cancel_registration(
    session: Session,
    user: User,
    event_id: UUID,
) -> RegistrationResponse:
    """Cancel the caller's own registration and promote the waitlist if needed."""

    try:
        event = load_event(session, event_id, lock=True)
        profile = require_player_profile(session, user)
        registration = session.scalar(
            select(Registration)
            .where(
                Registration.event_id == event.id,
                Registration.player_profile_id == profile.id,
            )
            .with_for_update()
        )
        if registration is None:
            raise RegistrationNotFoundError("Registration was not found.")
        if registration.status == RegistrationStatus.CANCELLED.value:
            return registration_response(registration)
        if registration.status in {
            RegistrationStatus.DECLINED.value,
            RegistrationStatus.REMOVED.value,
        }:
            raise RegistrationConflictError("Registration is already closed.")

        released_seat = registration.status == RegistrationStatus.CONFIRMED.value
        registration.status = RegistrationStatus.CANCELLED.value
        registration.cancelled_at = datetime.now(UTC)
        if released_seat:
            promote_waitlist(session, event)
        booking = booking_for_event(session, event.id, lock=True)
        synchronize_event_state(session, event, booking)
        session.commit()
        return registration_response(registration)
    except (EventForbiddenError, RegistrationNotFoundError, RegistrationConflictError):
        session.rollback()
        raise
    except SQLAlchemyError as exc:
        session.rollback()
        LOGGER.exception("Player registration cancellation failed")
        raise RegistrationPersistenceError(
            "Registration could not be cancelled."
        ) from exc


def _initial_status(join_mode: str, confirmed: int, max_players: int) -> str:
    if confirmed >= max_players:
        return RegistrationStatus.WAITLISTED.value
    if join_mode == EventJoinMode.INSTANT_JOIN.value:
        return RegistrationStatus.CONFIRMED.value
    return RegistrationStatus.REQUESTED.value


__all__ = ["cancel_registration", "request_registration"]
