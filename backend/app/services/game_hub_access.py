"""Strict role and recipient resolution for the authenticated Game Hub."""

from collections.abc import Mapping
from dataclasses import dataclass
from types import MappingProxyType
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
from app.services.event_access import EventNotFoundError, load_event


@dataclass(frozen=True, slots=True)
class HubAccessContext:
    event: Event
    viewer_roles: tuple[str, ...]
    gm_user_id: UUID
    venue_manager_user_ids: frozenset[UUID]
    confirmed_player_registration_by_user: Mapping[UUID, UUID]

    @property
    def confirmed_player_user_ids(self) -> frozenset[UUID]:
        return frozenset(self.confirmed_player_registration_by_user)


def require_hub_access(session: Session, user: User, event_id: UUID) -> HubAccessContext:
    if user.status != AccountStatus.ACTIVE.value:
        raise EventNotFoundError("Game Hub was not found.")
    event = load_event(session, event_id)
    gm_user_id = session.scalar(
        select(GMProfile.user_id).where(GMProfile.id == event.gm_profile_id)
    )
    if gm_user_id is None:
        raise EventNotFoundError("Game Hub was not found.")
    venue_manager_ids = set(
        session.scalars(
            select(VenueManager.user_id)
            .join(User, User.id == VenueManager.user_id)
            .where(
                VenueManager.venue_id == event.venue_id,
                VenueManager.verified_at.is_not(None),
                User.status == AccountStatus.ACTIVE.value,
            )
        ).all()
    )
    player_rows = session.execute(
        select(PlayerProfile.user_id, Registration.id)
        .join(User, User.id == PlayerProfile.user_id)
        .join(
            UserRole,
            (UserRole.user_id == User.id) & (UserRole.role == UserRoleType.PLAYER.value),
        )
        .join(Registration, Registration.player_profile_id == PlayerProfile.id)
        .where(
            Registration.event_id == event.id,
            Registration.status == RegistrationStatus.CONFIRMED.value,
            User.status == AccountStatus.ACTIVE.value,
        )
    ).all()
    player_map = {user_id: registration_id for user_id, registration_id in player_rows}
    durable_roles = set(
        session.scalars(select(UserRole.role).where(UserRole.user_id == user.id)).all()
    )
    roles: list[str] = []
    if user.id == gm_user_id and UserRoleType.GM.value in durable_roles:
        roles.append("gm")
    if user.id in player_map and UserRoleType.PLAYER.value in durable_roles:
        roles.append("player")
    if user.id in venue_manager_ids and UserRoleType.VENUE_MANAGER.value in durable_roles:
        roles.append("venue_manager")
    if not roles:
        raise EventNotFoundError("Game Hub was not found.")
    return HubAccessContext(
        event,
        tuple(roles),
        gm_user_id,
        frozenset(venue_manager_ids),
        MappingProxyType(player_map),
    )


def resolve_confirmed_registration_user(
    session: Session,
    *,
    event_id: UUID,
    registration_id: UUID,
) -> UUID:
    user_id = session.scalar(
        select(PlayerProfile.user_id)
        .join(User, User.id == PlayerProfile.user_id)
        .join(
            UserRole,
            (UserRole.user_id == User.id) & (UserRole.role == UserRoleType.PLAYER.value),
        )
        .join(Registration, Registration.player_profile_id == PlayerProfile.id)
        .where(
            Registration.id == registration_id,
            Registration.event_id == event_id,
            Registration.status == RegistrationStatus.CONFIRMED.value,
            User.status == AccountStatus.ACTIVE.value,
        )
    )
    if user_id is None:
        raise EventNotFoundError("Registration was not found.")
    return user_id


__all__ = [
    "HubAccessContext",
    "require_hub_access",
    "resolve_confirmed_registration_user",
]
