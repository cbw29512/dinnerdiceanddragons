"""Authenticated Player Event registration request transaction."""

import logging
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.event import EventStatus
from app.models.registration import Registration, RegistrationStatus
from app.services.event_formation_reconciliation import reconcile_event_formation
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
            return _existing_registration_result(session, event, booking, existing)

        registration = Registration(
            event_id=event.id,
            player_profile_id=player.id,
            status=(
                RegistrationStatus.WAITLISTED.value
                if confirmed_count(session, event.id) >= event.max_players
                else RegistrationStatus.REQUESTED.value
            ),
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


def _existing_registration_result(
    session: Session,
    event,
    booking,
    registration: Registration,
) -> RegistrationMutationResult:
    if registration.status not in {
        RegistrationStatus.REQUESTED.value,
        RegistrationStatus.CONFIRMED.value,
        RegistrationStatus.WAITLISTED.value,
    }:
        raise TableFormationConflictError("Registration is no longer requestable.")
    reconcile_event_formation(session, event=event, booking=booking)
    session.commit()
    return mutation_result(registration, event, booking)


__all__ = ["request_event_registration"]
