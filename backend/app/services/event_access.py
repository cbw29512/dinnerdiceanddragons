"""Durable resource-ownership checks for Event lifecycle operations."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.event import Event
from app.models.gm_profile import GMProfile
from app.models.player_demand_signal import PlayerDemandSignal
from app.models.player_profile import PlayerProfile
from app.models.registration import Registration
from app.models.table_match_player import TableMatchPlayer
from app.models.user import User
from app.models.venue import VenueManager


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
    gm = session.scalar(
        select(GMProfile).where(
            GMProfile.id == event.gm_profile_id,
            GMProfile.user_id == user.id,
        )
    )
    if gm is None:
        raise EventForbiddenError("Only the Event GM can perform this action.")
    return gm


def require_player_profile(session: Session, user: User) -> PlayerProfile:
    profile = session.scalar(select(PlayerProfile).where(PlayerProfile.user_id == user.id))
    if profile is None:
        raise EventForbiddenError("A Player profile is required for this action.")
    return profile


def player_is_matched(session: Session, event: Event, profile: PlayerProfile) -> bool:
    if event.table_match_id is None:
        return False
    return (
        session.scalar(
            select(TableMatchPlayer.player_demand_signal_id)
            .join(
                PlayerDemandSignal,
                PlayerDemandSignal.id == TableMatchPlayer.player_demand_signal_id,
            )
            .where(
                TableMatchPlayer.table_match_id == event.table_match_id,
                PlayerDemandSignal.player_profile_id == profile.id,
            )
            .limit(1)
        )
        is not None
    )


def require_verified_venue_manager(session: Session, user: User, event: Event) -> VenueManager:
    manager = session.scalar(
        select(VenueManager).where(
            VenueManager.venue_id == event.venue_id,
            VenueManager.user_id == user.id,
            VenueManager.verified_at.is_not(None),
        )
    )
    if manager is None:
        raise EventForbiddenError("Verified Venue Manager access is required.")
    return manager


def viewer_roles(session: Session, user: User, event: Event) -> tuple[str, ...]:
    roles: list[str] = []
    if session.scalar(
        select(GMProfile.id).where(
            GMProfile.id == event.gm_profile_id,
            GMProfile.user_id == user.id,
        )
    ):
        roles.append("gm")
    if session.scalar(
        select(VenueManager.id).where(
            VenueManager.venue_id == event.venue_id,
            VenueManager.user_id == user.id,
            VenueManager.verified_at.is_not(None),
        )
    ):
        roles.append("venue_manager")

    player = session.scalar(select(PlayerProfile).where(PlayerProfile.user_id == user.id))
    if player is not None:
        registered = session.scalar(
            select(Registration.id).where(
                Registration.event_id == event.id,
                Registration.player_profile_id == player.id,
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
