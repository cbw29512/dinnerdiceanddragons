"""Durable resource-ownership checks for Event lifecycle operations."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.event import Event
from app.models.gm_profile import GMProfile
from app.models.player_profile import PlayerProfile
from app.models.registration import Registration, RegistrationStatus
from app.models.user import AccountStatus, User
from app.models.user_role import UserRole, UserRoleType
from app.models.venue import VenueManager
from app.services.event_participant_eligibility import (
    player_profile_is_currently_eligible,
)


class EventNotFoundError(LookupError):
    pass


class EventForbiddenError(PermissionError):
    pass


def load_event(session: Session, event_id: UUID, *, lock: bool = False) -> Event:
    query = select(Event).where(Event.id == event_id)
    if lock:
        query = query.with_for_update()
    event = session.scalar(query)
    if event is None:
        raise EventNotFoundError("Event was not found.")
    return event


def require_gm_owner(session: Session, user: User, event: Event) -> GMProfile:
    if user.status != AccountStatus.ACTIVE.value:
        raise EventForbiddenError("Only the Event GM can perform this action.")
    gm = session.scalar(
        select(GMProfile)
        .join(
            UserRole,
            (UserRole.user_id == GMProfile.user_id)
            & (UserRole.role == UserRoleType.GM.value),
        )
        .where(
            GMProfile.id == event.gm_profile_id,
            GMProfile.user_id == user.id,
        )
    )
    if gm is None:
        raise EventForbiddenError("Only the Event GM can perform this action.")
    return gm


def require_player_profile(session: Session, user: User) -> PlayerProfile:
    if user.status != AccountStatus.ACTIVE.value:
        raise EventForbiddenError("A current Player role is required for this action.")
    profile = session.scalar(
        select(PlayerProfile)
        .join(
            UserRole,
            (UserRole.user_id == PlayerProfile.user_id)
            & (UserRole.role == UserRoleType.PLAYER.value),
        )
        .where(PlayerProfile.user_id == user.id)
    )
    if profile is None:
        raise EventForbiddenError("A current Player role is required for this action.")
    return profile


def player_is_matched(session: Session, event: Event, profile: PlayerProfile) -> bool:
    return player_profile_is_currently_eligible(
        session,
        table_match_id=event.table_match_id,
        player_profile_id=profile.id,
    )


def require_verified_venue_manager(
    session: Session,
    user: User,
    event: Event,
) -> VenueManager:
    if user.status != AccountStatus.ACTIVE.value:
        raise EventForbiddenError("Verified Venue Manager access is required.")
    manager = session.scalar(
        select(VenueManager)
        .join(
            UserRole,
            (UserRole.user_id == VenueManager.user_id)
            & (UserRole.role == UserRoleType.VENUE_MANAGER.value),
        )
        .where(
            VenueManager.venue_id == event.venue_id,
            VenueManager.user_id == user.id,
            VenueManager.verified_at.is_not(None),
        )
    )
    if manager is None:
        raise EventForbiddenError("Verified Venue Manager access is required.")
    return manager


def viewer_roles(session: Session, user: User, event: Event) -> tuple[str, ...]:
    if user.status != AccountStatus.ACTIVE.value:
        return ()

    roles: list[str] = []
    gm_role = session.scalar(
        select(UserRole.user_id).where(
            UserRole.user_id == user.id,
            UserRole.role == UserRoleType.GM.value,
        )
    )
    if gm_role is not None and session.scalar(
        select(GMProfile.id).where(
            GMProfile.id == event.gm_profile_id,
            GMProfile.user_id == user.id,
        )
    ):
        roles.append("gm")

    venue_role = session.scalar(
        select(UserRole.user_id).where(
            UserRole.user_id == user.id,
            UserRole.role == UserRoleType.VENUE_MANAGER.value,
        )
    )
    if venue_role is not None and session.scalar(
        select(VenueManager.id).where(
            VenueManager.venue_id == event.venue_id,
            VenueManager.user_id == user.id,
            VenueManager.verified_at.is_not(None),
        )
    ):
        roles.append("venue_manager")

    player_role = session.scalar(
        select(UserRole.user_id).where(
            UserRole.user_id == user.id,
            UserRole.role == UserRoleType.PLAYER.value,
        )
    )
    player = session.scalar(select(PlayerProfile).where(PlayerProfile.user_id == user.id))
    if player_role is not None and player is not None:
        registered = session.scalar(
            select(Registration.id).where(
                Registration.event_id == event.id,
                Registration.player_profile_id == player.id,
                Registration.status.in_(
                    {
                        RegistrationStatus.REQUESTED.value,
                        RegistrationStatus.CONFIRMED.value,
                        RegistrationStatus.WAITLISTED.value,
                    }
                ),
            )
        )
        if registered is not None or player_is_matched(session, event, player):
            roles.append("player")
    return tuple(roles)


__all__ = [
    "EventForbiddenError",
    "EventNotFoundError",
    "load_event",
    "player_is_matched",
    "require_gm_owner",
    "require_player_profile",
    "require_verified_venue_manager",
    "viewer_roles",
]
