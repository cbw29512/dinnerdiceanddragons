"""Deterministic waitlist promotion after confirmed seats open."""

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.event import Event, EventJoinMode
from app.models.registration import Registration, RegistrationStatus
from app.services.event_lifecycle_state import confirmed_registration_count


def promote_waitlist(session: Session, event: Event) -> list[Registration]:
    """Promote oldest waitlisted rows until no seat remains."""

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
        .limit(available)
    ).all()

    now = datetime.now(UTC)
    target_status = (
        RegistrationStatus.CONFIRMED.value
        if event.join_mode == EventJoinMode.INSTANT_JOIN.value
        else RegistrationStatus.REQUESTED.value
    )
    for registration in waitlisted:
        registration.status = target_status
        registration.responded_at = now if target_status == RegistrationStatus.CONFIRMED.value else None
    return list(waitlisted)


__all__ = ["promote_waitlist"]
