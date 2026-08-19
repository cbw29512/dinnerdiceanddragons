"""Deterministic waitlist promotion after confirmed seats open."""

import logging
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.event import Event, EventJoinMode
from app.models.registration import Registration, RegistrationStatus
from app.services.event_lifecycle_state import confirmed_registration_count
from app.services.event_participant_eligibility import (
    player_profile_is_currently_eligible,
)
from app.services.game_table_membership_sync import confirm_game_table_membership

LOGGER = logging.getLogger(__name__)


def promote_waitlist(session: Session, event: Event) -> list[Registration]:
    """Promote oldest currently eligible waitlisted rows until no seat remains."""

    try:
        # Callers may have just cancelled/removed a confirmed seat. Production
        # sessions use autoflush=False, so make that mutation visible to the count.
        session.flush()
        confirmed = confirmed_registration_count(session, event.id)
        available = max(event.max_players - confirmed, 0)
        if available == 0:
            return []

        waitlisted = session.scalars(
            select(Registration)
            .where(
                Registration.event_id == event.id,
                Registration.status == RegistrationStatus.WAITLISTED.value,
            )
            .order_by(Registration.requested_at, Registration.id)
            .with_for_update()
        ).all()

        now = datetime.now(UTC)
        target_status = (
            RegistrationStatus.CONFIRMED.value
            if event.join_mode == EventJoinMode.INSTANT_JOIN.value
            else RegistrationStatus.REQUESTED.value
        )
        promoted: list[Registration] = []
        for registration in waitlisted:
            if len(promoted) >= available:
                break
            if not player_profile_is_currently_eligible(
                session,
                table_match_id=event.table_match_id,
                player_profile_id=registration.player_profile_id,
            ):
                continue
            registration.status = target_status
            registration.responded_at = (
                now if target_status == RegistrationStatus.CONFIRMED.value else None
            )
            registration.cancelled_at = None
            if target_status == RegistrationStatus.CONFIRMED.value:
                confirm_game_table_membership(
                    session,
                    event,
                    registration.player_profile_id,
                )
            promoted.append(registration)

        # Make promotions visible to the subsequent lifecycle reconciliation query.
        session.flush()
        return promoted
    except Exception:
        # Transaction ownership remains with the caller; this helper must not commit
        # or roll back independently, but it still records failures for diagnosis.
        LOGGER.exception("Failed to promote Event waitlist event_id=%s", event.id)
        raise


__all__ = ["promote_waitlist"]
