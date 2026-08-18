"""Authenticated Player Event registration cancellation transaction."""

import logging
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.registration import Registration, RegistrationStatus
from app.services.event_formation_reconciliation import (
    promote_next_waitlisted_registration,
    reconcile_event_formation,
)
from app.services.event_registration_access import require_event_player
from app.services.event_registration_state import (
    RegistrationMutationResult,
    locked_event_and_booking,
    mutation_result,
)
from app.services.table_formation_errors import (
    TableFormationConflictError,
    TableFormationError,
    TableFormationNotFoundError,
)

LOGGER = logging.getLogger(__name__)


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


__all__ = ["cancel_my_registration"]
