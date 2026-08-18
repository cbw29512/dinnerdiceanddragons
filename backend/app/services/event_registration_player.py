"""Authenticated Player request and cancellation transactions for Event seats."""

import logging
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.event import EventStatus
from app.models.registration import Registration, RegistrationStatus
from app.services.event_formation_reconciliation import (
    promote_next_waitlisted_registration,
    reconcile_event_formation,
)
from app.services.event_registration_access import require_event_player
from app.services.event_registration_state import (
    RegistrationMutationResult,
    confirmed_count,
    locked_event_and_booking,
    mutation_result,
)
from app.services.table_formation_errors import (
    TableFormationConflictError,
    TableFormationError,
    TableFormationNotFoundError,
)

LOGGER = logging.getLogger(__name__)
REGISTRATION_OPEN_EVENT_STATUSES = {
    EventStatus.VENUE_REQUESTED.value,
    EventStatus.FORMING.value,
    EventStatus.CONFIRMED.value,
    EventStatus.FULL.value,
}


def request_event_registration(
    session: Session,
    *,
    event_id: UUID,
    caller_user_id: UUID,
    expectations_acknowledged: bool,
) -> RegistrationMutationResult:
    """Create one self-owned registration request or waitlist entry idempotently."""

    try:
        event, booking = locked_event_and_booking(session, event_id)
        if event.status not in REGISTRATION_OPEN_EVENT_STATUSES:
            raise TableFormationConflictError("Event is not accepting registrations.")
        if not expectations_acknowledged:
            raise TableFormationConflictError("Table expectations must be acknowledged.")

        player = require_event_player(
            session,
            event=event,
            caller_user_id=caller_user_id,
        )
        existing = session.scalar(
            select(Registration)
            .where(
                Registration.event_id == event.id,
                Registration.player_profile_id == player.id,
            )
            .with_for_update()
        )
        if existing is not None:
            if existing.status in {
                RegistrationStatus.REQUESTED.value,
                RegistrationStatus.CONFIRMED.value,
                RegistrationStatus.WAITLISTED.value,
            }:
                reconcile_event_formation(session, event=event, booking=booking)
                session.commit()
                return mutation_result(existing, event, booking)
            raise TableFormationConflictError("Registration is no longer requestable.")

        status = (
            RegistrationStatus.WAITLISTED.value
            if confirmed_count(session, event.id) >= event.max_players
            else RegistrationStatus.REQUESTED.value
        )
        registration = Registration(
            event_id=event.id,
            player_profile_id=player.id,
            status=status,
            expectations_acknowledged_at=datetime.now(UTC),
        )
        session.add(registration)
        reconcile_event_formation(session, event=event, booking=booking)
        session.commit()
        return mutation_result(registration, event, booking)
    except IntegrityError:
        session.rollback()
        LOGGER.exception("Registration uniqueness conflict")
        raise TableFormationConflictError("Registration conflicted with current state.") from None
    except TableFormationError:
        session.rollback()
        raise
    except Exception:
        session.rollback()
        LOGGER.exception("Player registration request failed")
        raise


def cancel_my_registration(
    session: Session,
    *,
    event_id: UUID,
    caller_user_id: UUID,
) -> RegistrationMutationResult:
    """Cancel the caller's registration and promote the waitlist when a seat opens."""

    try:
        event, booking = locked_event_and_booking(session, event_id)
        player = require_event_player(
            session,
            event=event,
            caller_user_id=caller_user_id,
        )
        registration = session.scalar(
            select(Registration)
            .where(
                Registration.event_id == event.id,
                Registration.player_profile_id == player.id,
            )
            .with_for_update()
        )
        if registration is None:
            raise TableFormationNotFoundError("Registration is not available.")
        if registration.status == RegistrationStatus.CANCELLED.value:
            return mutation_result(registration, event, booking)
        if registration.status in {
            RegistrationStatus.DECLINED.value,
            RegistrationStatus.REMOVED.value,
        }:
            raise TableFormationConflictError("Registration can no longer be cancelled.")

        was_confirmed = registration.status == RegistrationStatus.CONFIRMED.value
        registration.status = RegistrationStatus.CANCELLED.value
        registration.cancelled_at = datetime.now(UTC)
        if was_confirmed:
            promote_next_waitlisted_registration(session, event=event)

        reconcile_event_formation(session, event=event, booking=booking)
        session.commit()
        return mutation_result(registration, event, booking)
    except TableFormationError:
        session.rollback()
        raise
    except Exception:
        session.rollback()
        LOGGER.exception("Player registration cancellation failed")
        raise


__all__ = ["cancel_my_registration", "request_event_registration"]
