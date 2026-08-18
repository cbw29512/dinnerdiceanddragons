"""Transaction-safe Player seat requests, GM decisions, and cancellations."""

import logging
from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.event import Event, EventStatus
from app.models.registration import Registration, RegistrationStatus
from app.models.venue_booking_request import VenueBookingRequest
from app.services.event_formation_reconciliation import (
    promote_next_waitlisted_registration,
    reconcile_event_formation,
)
from app.services.event_registration_access import require_event_gm, require_event_player
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


@dataclass(frozen=True, slots=True)
class RegistrationMutationResult:
    """Public-safe result after a seat lifecycle mutation."""

    registration_id: UUID
    status: str
    event_status: str
    expected_guests: int


def request_event_registration(
    session: Session,
    *,
    event_id: UUID,
    caller_user_id: UUID,
    expectations_acknowledged: bool,
) -> RegistrationMutationResult:
    """Create one self-owned registration request or waitlist entry idempotently."""

    try:
        event, booking = _locked_event_and_booking(session, event_id)
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
                return _result(existing, event, booking)
            raise TableFormationConflictError("Registration is no longer requestable.")

        status = (
            RegistrationStatus.WAITLISTED.value
            if _confirmed_count(session, event.id) >= event.max_players
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
        return _result(registration, event, booking)
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


def decide_event_registration(
    session: Session,
    *,
    event_id: UUID,
    registration_id: UUID,
    caller_user_id: UUID,
    target_status: str,
) -> RegistrationMutationResult:
    """Allow the owning GM to confirm, waitlist, decline, or remove one Player."""

    try:
        event, booking = _locked_event_and_booking(session, event_id)
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

        was_confirmed = registration.status == RegistrationStatus.CONFIRMED.value
        _apply_gm_decision(session, event, registration, target_status)
        if was_confirmed and registration.status != RegistrationStatus.CONFIRMED.value:
            promote_next_waitlisted_registration(session, event=event)

        reconcile_event_formation(session, event=event, booking=booking)
        session.commit()
        return _result(registration, event, booking)
    except TableFormationError:
        session.rollback()
        raise
    except Exception:
        session.rollback()
        LOGGER.exception("GM registration decision failed")
        raise


def cancel_my_registration(
    session: Session,
    *,
    event_id: UUID,
    caller_user_id: UUID,
) -> RegistrationMutationResult:
    """Cancel the authenticated Player's registration and promote the waitlist if needed."""

    try:
        event, booking = _locked_event_and_booking(session, event_id)
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
            return _result(registration, event, booking)
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
        return _result(registration, event, booking)
    except TableFormationError:
        session.rollback()
        raise
    except Exception:
        session.rollback()
        LOGGER.exception("Player registration cancellation failed")
        raise


def _apply_gm_decision(
    session: Session,
    event: Event,
    registration: Registration,
    target_status: str,
) -> None:
    now = datetime.now(UTC)
    if target_status == RegistrationStatus.CONFIRMED.value:
        if registration.status == RegistrationStatus.CONFIRMED.value:
            return
        if registration.status not in {
            RegistrationStatus.REQUESTED.value,
            RegistrationStatus.WAITLISTED.value,
        }:
            raise TableFormationConflictError("Registration cannot be confirmed.")
        registration.status = (
            RegistrationStatus.WAITLISTED.value
            if _confirmed_count(session, event.id) >= event.max_players
            else RegistrationStatus.CONFIRMED.value
        )
        registration.responded_at = now
        registration.cancelled_at = None
        return

    if target_status == RegistrationStatus.WAITLISTED.value:
        if registration.status not in {
            RegistrationStatus.REQUESTED.value,
            RegistrationStatus.WAITLISTED.value,
        }:
            raise TableFormationConflictError("Registration cannot be waitlisted.")
        registration.status = RegistrationStatus.WAITLISTED.value
        registration.responded_at = now
        return

    if target_status == RegistrationStatus.DECLINED.value:
        if registration.status not in {
            RegistrationStatus.REQUESTED.value,
            RegistrationStatus.WAITLISTED.value,
        }:
            raise TableFormationConflictError("Registration cannot be declined.")
        registration.status = RegistrationStatus.DECLINED.value
        registration.responded_at = now
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


def _locked_event_and_booking(
    session: Session,
    event_id: UUID,
) -> tuple[Event, VenueBookingRequest]:
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


def _confirmed_count(session: Session, event_id: UUID) -> int:
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


def _result(
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
    "cancel_my_registration",
    "decide_event_registration",
    "request_event_registration",
]
