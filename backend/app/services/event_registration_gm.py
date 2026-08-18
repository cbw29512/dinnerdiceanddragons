"""Owning-GM decisions for Event registration requests and waitlist seats."""

import logging
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.event import Event, EventStatus
from app.models.registration import Registration, RegistrationStatus
from app.services.event_formation_reconciliation import (
    promote_next_waitlisted_registration,
    reconcile_event_formation,
)
from app.services.event_registration_access import (
    require_event_gm,
    require_player_profile_eligible,
)
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


def decide_event_registration(
    session: Session,
    *,
    event_id: UUID,
    registration_id: UUID,
    caller_user_id: UUID,
    target_status: str,
) -> RegistrationMutationResult:
    """Confirm, waitlist, decline, or remove one Player under the Event lock."""

    try:
        event, booking = locked_event_and_booking(session, event_id)
        require_event_gm(session, event=event, caller_user_id=caller_user_id)
        if event.status in {EventStatus.CANCELLED.value, EventStatus.COMPLETED.value}:
            raise TableFormationConflictError("Event registration state is closed.")

        registration = session.scalar(
            select(Registration)
            .where(
                Registration.id == registration_id,
                Registration.event_id == event.id,
            )
            .with_for_update()
        )
        if registration is None:
            raise TableFormationNotFoundError("Registration is not available.")

        if target_status in {
            RegistrationStatus.CONFIRMED.value,
            RegistrationStatus.WAITLISTED.value,
        }:
            require_player_profile_eligible(
                session,
                event=event,
                player_profile_id=registration.player_profile_id,
            )

        was_confirmed = registration.status == RegistrationStatus.CONFIRMED.value
        _apply_gm_decision(session, event, registration, target_status)
        if was_confirmed and registration.status != RegistrationStatus.CONFIRMED.value:
            promote_next_waitlisted_registration(session, event=event)

        reconcile_event_formation(session, event=event, booking=booking)
        session.commit()
        return mutation_result(registration, event, booking)
    except TableFormationError:
        session.rollback()
        raise
    except Exception:
        session.rollback()
        LOGGER.exception("GM registration decision failed")
        raise


def _apply_gm_decision(
    session: Session,
    event: Event,
    registration: Registration,
    target_status: str,
) -> None:
    now = datetime.now(UTC)
    if target_status == RegistrationStatus.CONFIRMED.value:
        _confirm_or_waitlist(session, event, registration, now)
        return
    if target_status == RegistrationStatus.WAITLISTED.value:
        _set_pending_status(registration, RegistrationStatus.WAITLISTED.value, now)
        return
    if target_status == RegistrationStatus.DECLINED.value:
        _set_pending_status(registration, RegistrationStatus.DECLINED.value, now)
        return
    if target_status == RegistrationStatus.REMOVED.value:
        if registration.status not in {
            RegistrationStatus.REQUESTED.value,
            RegistrationStatus.WAITLISTED.value,
            RegistrationStatus.CONFIRMED.value,
        }:
            raise TableFormationConflictError("Registration cannot be removed.")
        registration.status = RegistrationStatus.REMOVED.value
        registration.responded_at = now
        return
    raise TableFormationConflictError("Unsupported registration transition.")


def _confirm_or_waitlist(
    session: Session,
    event: Event,
    registration: Registration,
    now: datetime,
) -> None:
    if registration.status == RegistrationStatus.CONFIRMED.value:
        return
    if registration.status not in {
        RegistrationStatus.REQUESTED.value,
        RegistrationStatus.WAITLISTED.value,
    }:
        raise TableFormationConflictError("Registration cannot be confirmed.")
    registration.status = (
        RegistrationStatus.WAITLISTED.value
        if confirmed_count(session, event.id) >= event.max_players
        else RegistrationStatus.CONFIRMED.value
    )
    registration.responded_at = now
    registration.cancelled_at = None


def _set_pending_status(
    registration: Registration,
    target_status: str,
    now: datetime,
) -> None:
    if registration.status not in {
        RegistrationStatus.REQUESTED.value,
        RegistrationStatus.WAITLISTED.value,
    }:
        raise TableFormationConflictError(f"Registration cannot be {target_status}.")
    registration.status = target_status
    registration.responded_at = now


__all__ = ["decide_event_registration"]
