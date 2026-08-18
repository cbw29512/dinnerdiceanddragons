"""Role-safe formed Event reads and owning-GM registration queue access."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.event import Event
from app.models.registration import Registration
from app.models.user import User
from app.schemas.table_formation import (
    EventFormationDetailResponse,
    EventFormationResponse,
    GMRegistrationQueueItemResponse,
)
from app.services.event_formation_access import event_access_query, user_roles
from app.services.event_formation_read_state import render_event_detail, render_event_summary
from app.services.event_registration_access import require_event_gm
from app.services.table_formation_errors import TableFormationNotFoundError


def list_formed_events(session: Session, user: User) -> list[EventFormationResponse]:
    """List every formed Event the authenticated caller may currently access."""

    roles = user_roles(session, user.id)
    events = session.scalars(
        event_access_query(user.id, roles).order_by(Event.starts_at, Event.id)
    ).all()
    return [
        render_event_summary(
            session,
            event=event,
            user_id=user.id,
            roles=roles,
        )
        for event in events
    ]


def get_formed_event(
    session: Session,
    user: User,
    event_id: UUID,
) -> EventFormationDetailResponse:
    """Return one formed Event or a non-leaking not-found result."""

    roles = user_roles(session, user.id)
    event = session.scalar(
        event_access_query(user.id, roles).where(Event.id == event_id)
    )
    if event is None:
        raise TableFormationNotFoundError("Event is not available.")
    return render_event_detail(
        session,
        event=event,
        user_id=user.id,
        roles=roles,
    )


def list_event_registration_queue(
    session: Session,
    user: User,
    event_id: UUID,
) -> list[GMRegistrationQueueItemResponse]:
    """Return the owning GM's decision queue without emails or location data."""

    event = session.get(Event, event_id)
    if event is None:
        raise TableFormationNotFoundError("Event is not available.")
    require_event_gm(session, event=event, caller_user_id=user.id)

    registrations = session.scalars(
        select(Registration)
        .where(Registration.event_id == event.id)
        .order_by(Registration.requested_at, Registration.id)
    ).all()
    return [
        GMRegistrationQueueItemResponse(
            id=registration.id,
            player_profile_id=registration.player_profile_id,
            status=registration.status,
            requested_at=registration.requested_at,
            expectations_acknowledged=(
                registration.expectations_acknowledged_at is not None
            ),
        )
        for registration in registrations
    ]


__all__ = [
    "get_formed_event",
    "list_event_registration_queue",
    "list_formed_events",
]
