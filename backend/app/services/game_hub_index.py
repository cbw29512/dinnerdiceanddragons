"""Bounded authenticated index of the caller's live Game Hubs."""

from sqlalchemy import exists, or_, select
from sqlalchemy.orm import Session

from app.models.event import Event
from app.models.game_system import GameSystem
from app.models.gm_profile import GMProfile
from app.models.player_profile import PlayerProfile
from app.models.registration import Registration, RegistrationStatus
from app.models.user import User
from app.models.user_role import UserRole, UserRoleType
from app.models.venue import Venue, VenueManager
from app.schemas.game_hub import HubIndexItem

MAX_HUB_INDEX_ITEMS = 50


def list_game_hubs(session: Session, user: User) -> list[HubIndexItem]:
    """List a bounded set of Events the caller may enter as a live Hub participant."""

    gm_access = exists(
        select(GMProfile.id)
        .join(
            UserRole,
            (UserRole.user_id == GMProfile.user_id)
            & (UserRole.role == UserRoleType.GM.value),
        )
        .where(GMProfile.id == Event.gm_profile_id, GMProfile.user_id == user.id)
    )
    player_access = exists(
        select(Registration.id)
        .join(PlayerProfile, PlayerProfile.id == Registration.player_profile_id)
        .join(
            UserRole,
            (UserRole.user_id == PlayerProfile.user_id)
            & (UserRole.role == UserRoleType.PLAYER.value),
        )
        .where(
            Registration.event_id == Event.id,
            Registration.status == RegistrationStatus.CONFIRMED.value,
            PlayerProfile.user_id == user.id,
        )
    )
    venue_access = exists(
        select(VenueManager.id)
        .join(
            UserRole,
            (UserRole.user_id == VenueManager.user_id)
            & (UserRole.role == UserRoleType.VENUE_MANAGER.value),
        )
        .where(
            VenueManager.venue_id == Event.venue_id,
            VenueManager.user_id == user.id,
            VenueManager.verified_at.is_not(None),
        )
    )
    rows = session.execute(
        select(Event, Venue, GameSystem)
        .join(Venue, Venue.id == Event.venue_id)
        .join(GameSystem, GameSystem.id == Event.game_system_id)
        .where(or_(gm_access, player_access, venue_access))
        .order_by(Event.starts_at.desc(), Event.id)
        .limit(MAX_HUB_INDEX_ITEMS)
    ).all()
    return [
        HubIndexItem(
            event_id=event.id,
            title=event.title,
            status=event.status,
            starts_at=event.starts_at,
            ends_at=event.ends_at,
            venue_name=venue.name,
            venue_city=venue.city,
            venue_state_region=venue.state_region,
            system_name=system.name,
            system_edition=system.edition,
        )
        for event, venue, system in rows
    ]


__all__ = ["MAX_HUB_INDEX_ITEMS", "list_game_hubs"]
