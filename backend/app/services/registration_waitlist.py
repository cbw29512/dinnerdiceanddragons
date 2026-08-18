"""Deterministic waitlist promotion after confirmed seats open."""

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.event import Event, EventJoinMode
from app.models.registration import Registration, RegistrationStatus
from app.services.event_lifecycle_state import confirmed_registration_count
from app.services.event_participant_eligibility import (
    player_profile_is_currently_eligible,
)


def promote_waitlist(session: Session, event: Event) -> list[Registration]:
    """Promote oldest currently eligible waitlisted rows until no seat remains."""

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
        promoted.append(registration)

    # Make promotions visible to the subsequent lifecycle reconciliation query.
    session.flush()
    return promoted


__all__ = ["promote_waitlist"]
