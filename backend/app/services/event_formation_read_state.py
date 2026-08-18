"""Role-safe rendering of one formed Event into API response schemas."""

from collections import Counter
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.event import Event
from app.models.game_system import GameSystem
from app.models.player_profile import PlayerProfile
from app.models.registration import Registration
from app.models.table_expectations import TableExpectations
from app.models.user_role import UserRoleType
from app.models.venue import Venue
from app.models.venue_booking_request import VenueBookingRequest
from app.schemas.table_formation import (
    EventFormationDetailResponse,
    EventFormationResponse,
    EventSystemResponse,
    EventVenueResponse,
)
from app.services.event_expectations_read import render_event_expectations
from app.services.event_formation_access import event_viewer_roles
from app.services.table_formation_errors import TableFormationReadError


def render_event_summary(
    session: Session,
    *,
    event: Event,
    user_id: UUID,
    roles: frozenset[str],
) -> EventFormationResponse:
    """Render one formed Event without exposing private identities or locations."""

    system = session.get(GameSystem, event.game_system_id)
    venue = session.get(Venue, event.venue_id)
    booking = session.scalar(
        select(VenueBookingRequest).where(VenueBookingRequest.event_id == event.id)
    )
    if system is None or venue is None or booking is None:
        raise TableFormationReadError("Formed Event state is incomplete.")

    viewer_roles = event_viewer_roles(
        session,
        event=event,
        user_id=user_id,
        roles=roles,
    )
    counts = Counter(
        session.scalars(
            select(Registration.status).where(Registration.event_id == event.id)
        ).all()
    )
    own_registration = _own_registration(session, event.id, user_id, viewer_roles)
    booking_id = (
        booking.id
        if set(viewer_roles)
        & {UserRoleType.GM.value, UserRoleType.VENUE_MANAGER.value}
        else None
    )

    return EventFormationResponse(
        id=event.id,
        slug=event.slug,
        title=event.title,
        description=event.description,
        status=event.status,
        event_type=event.event_type,
        join_mode=event.join_mode,
        starts_at=event.starts_at,
        ends_at=event.ends_at,
        min_players=event.min_players,
        max_players=event.max_players,
        minimum_age=event.minimum_age,
        beginner_friendly=event.beginner_friendly,
        system=EventSystemResponse(
            slug=system.slug,
            name=system.name,
            edition=system.edition,
        ),
        venue=EventVenueResponse(
            id=venue.id,
            name=venue.name,
            city=venue.city,
            state_region=venue.state_region,
        ),
        confirmed_players=counts.get("confirmed", 0),
        requested_players=counts.get("requested", 0),
        waitlisted_players=counts.get("waitlisted", 0),
        expected_guests=booking.expected_guests,
        booking_status=booking.status,
        booking_id=booking_id,
        viewer_roles=list(viewer_roles),
        your_registration_id=own_registration.id if own_registration else None,
        your_registration_status=own_registration.status if own_registration else None,
    )


def render_event_detail(
    session: Session,
    *,
    event: Event,
    user_id: UUID,
    roles: frozenset[str],
) -> EventFormationDetailResponse:
    """Render one Event plus shared table expectations."""

    summary = render_event_summary(
        session,
        event=event,
        user_id=user_id,
        roles=roles,
    )
    expectations = session.scalar(
        select(TableExpectations).where(TableExpectations.event_id == event.id)
    )
    if expectations is None:
        raise TableFormationReadError("Formed Event expectations are missing.")
    return EventFormationDetailResponse(
        **summary.model_dump(),
        expectations=render_event_expectations(expectations),
    )


def _own_registration(
    session: Session,
    event_id: UUID,
    user_id: UUID,
    viewer_roles: tuple[str, ...],
) -> Registration | None:
    if UserRoleType.PLAYER.value not in viewer_roles:
        return None
    return session.scalar(
        select(Registration)
        .join(PlayerProfile, PlayerProfile.id == Registration.player_profile_id)
        .where(
            Registration.event_id == event_id,
            PlayerProfile.user_id == user_id,
        )
    )


__all__ = ["render_event_detail", "render_event_summary"]
