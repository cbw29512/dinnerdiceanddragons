"""Pure-ish owning-GM registration status transition rules."""

from datetime import datetime

from sqlalchemy.orm import Session

from app.models.event import Event
from app.models.registration import Registration, RegistrationStatus
from app.services.event_registration_state import confirmed_count
from app.services.table_formation_errors import TableFormationConflictError


def apply_gm_registration_decision(
    session: Session,
    event: Event,
    registration: Registration,
    target_status: str,
    now: datetime,
) -> None:
    """Apply one validated GM target status without committing the transaction."""

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


__all__ = ["apply_gm_registration_decision"]
