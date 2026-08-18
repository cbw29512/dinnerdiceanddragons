"""GM-owned registration confirmation, decline, and removal workflow."""

import logging
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.models.registration import RegistrationStatus
from app.models.user import User
from app.schemas.event_lifecycle import RegistrationResponse
from app.services.event_access import EventForbiddenError, load_event, require_gm_owner
from app.services.event_lifecycle_state import (
    booking_for_event,
    confirmed_registration_count,
    synchronize_event_state,
)
from app.services.event_participant_eligibility import (
    player_profile_is_currently_eligible,
)
from app.services.registration_common import (
    RegistrationConflictError,
    RegistrationPersistenceError,
    load_registration,
    registration_response,
)
from app.services.registration_waitlist import promote_waitlist

LOGGER = logging.getLogger(__name__)


def decide_registration(
    session: Session,
    user: User,
    event_id: UUID,
    registration_id: UUID,
    action: str,
) -> RegistrationResponse:
    """Apply one authorized GM decision under an Event row lock."""

    try:
        event = load_event(session, event_id, lock=True)
        require_gm_owner(session, user, event)
        registration = load_registration(
            session,
            registration_id,
            event_id=event.id,
            lock=True,
        )
        prior_status = registration.status
        now = datetime.now(UTC)

        if action == "confirm":
            if registration.status == RegistrationStatus.CONFIRMED.value:
                return registration_response(registration)
            if registration.status in {
                RegistrationStatus.CANCELLED.value,
                RegistrationStatus.DECLINED.value,
                RegistrationStatus.REMOVED.value,
            }:
                raise RegistrationConflictError(
                    "Closed registration cannot be confirmed."
                )
            if not player_profile_is_currently_eligible(
                session,
                table_match_id=event.table_match_id,
                player_profile_id=registration.player_profile_id,
            ):
                raise RegistrationConflictError(
                    "Player is no longer eligible for this matched table."
                )
            if confirmed_registration_count(session, event.id) >= event.max_players:
                raise RegistrationConflictError("No confirmed Player seat remains.")
            registration.status = RegistrationStatus.CONFIRMED.value
            registration.responded_at = now
        elif action == "decline":
            if registration.status == RegistrationStatus.DECLINED.value:
                return registration_response(registration)
            if registration.status in {
                RegistrationStatus.CANCELLED.value,
                RegistrationStatus.REMOVED.value,
            }:
                raise RegistrationConflictError(
                    "Closed registration cannot be declined."
                )
            registration.status = RegistrationStatus.DECLINED.value
            registration.responded_at = now
        elif action == "remove":
            if registration.status == RegistrationStatus.REMOVED.value:
                return registration_response(registration)
            if registration.status == RegistrationStatus.CANCELLED.value:
                raise RegistrationConflictError(
                    "Cancelled registration is already closed."
                )
            registration.status = RegistrationStatus.REMOVED.value
            registration.responded_at = now
        else:
            raise RegistrationConflictError("Unsupported GM registration action.")

        if (
            prior_status == RegistrationStatus.CONFIRMED.value
            and registration.status != prior_status
        ):
            promote_waitlist(session, event)
        booking = booking_for_event(session, event.id, lock=True)
        synchronize_event_state(session, event, booking)
        session.commit()
        return registration_response(registration)
    except (EventForbiddenError, RegistrationConflictError):
        session.rollback()
        raise
    except SQLAlchemyError as exc:
        session.rollback()
        LOGGER.exception("GM registration decision failed")
        raise RegistrationPersistenceError(
            "Registration decision could not be persisted."
        ) from exc


__all__ = ["decide_registration"]
