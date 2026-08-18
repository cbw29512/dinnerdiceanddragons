"""Role-scoped access predicates and queries for formed Events."""

from uuid import UUID

from sqlalchemy import Select, or_, select
from sqlalchemy.orm import Session

from app.models.event import Event
from app.models.gm_profile import GMProfile
from app.models.player_demand_signal import PlayerDemandSignal
from app.models.player_profile import PlayerProfile
from app.models.registration import Registration
from app.models.table_match_player import TableMatchPlayer
from app.models.user_role import UserRole, UserRoleType
from app.models.venue import VenueManager


def user_roles(session: Session, user_id: UUID) -> frozenset[str]:
    """Return the caller's durable DDD role keys."""

    return frozenset(
        session.scalars(select(UserRole.role).where(UserRole.user_id == user_id)).all()
    )


def event_access_query(user_id: UUID, roles: frozenset[str]) -> Select:
    """Build the formed-Event access filter for the authenticated caller."""

    conditions = []
    if UserRoleType.GM.value in roles:
        conditions.append(
            Event.gm_profile_id.in_(
                select(GMProfile.id).where(GMProfile.user_id == user_id)
            )
        )
    if UserRoleType.PLAYER.value in roles:
        eligible_events = select(Event.id).where(
            Event.table_match_id.in_(
                select(TableMatchPlayer.table_match_id)
                .join(
                    PlayerDemandSignal,
                    PlayerDemandSignal.id == TableMatchPlayer.player_demand_signal_id,
                )
                .join(
                    PlayerProfile,
                    PlayerProfile.id == PlayerDemandSignal.player_profile_id,
                )
                .where(PlayerProfile.user_id == user_id)
            )
        )
        registered_events = (
            select(Registration.event_id)
            .join(PlayerProfile, PlayerProfile.id == Registration.player_profile_id)
            .where(PlayerProfile.user_id == user_id)
        )
        conditions.extend(
            [
                Event.id.in_(eligible_events),
                Event.id.in_(registered_events),
            ]
        )
    if UserRoleType.VENUE_MANAGER.value in roles:
        conditions.append(
            Event.venue_id.in_(
                select(VenueManager.venue_id).where(
                    VenueManager.user_id == user_id,
                    VenueManager.verified_at.is_not(None),
                )
            )
        )

    return select(Event).where(
        or_(*conditions) if conditions else Event.id.is_(None)
    )


def event_viewer_roles(
    session: Session,
    *,
    event: Event,
    user_id: UUID,
    roles: frozenset[str],
) -> tuple[str, ...]:
    """Return only roles the caller actually holds for this specific Event."""

    viewer: list[str] = []
    if UserRoleType.GM.value in roles:
        owned = session.scalar(
            select(GMProfile.id).where(
                GMProfile.id == event.gm_profile_id,
                GMProfile.user_id == user_id,
            )
        )
        if owned is not None:
            viewer.append(UserRoleType.GM.value)

    if UserRoleType.PLAYER.value in roles and _player_can_view(session, event, user_id):
        viewer.append(UserRoleType.PLAYER.value)

    if UserRoleType.VENUE_MANAGER.value in roles:
        managed = session.scalar(
            select(VenueManager.id).where(
                VenueManager.venue_id == event.venue_id,
                VenueManager.user_id == user_id,
                VenueManager.verified_at.is_not(None),
            )
        )
        if managed is not None:
            viewer.append(UserRoleType.VENUE_MANAGER.value)
    return tuple(viewer)


def _player_can_view(session: Session, event: Event, user_id: UUID) -> bool:
    registered = session.scalar(
        select(Registration.id)
        .join(PlayerProfile, PlayerProfile.id == Registration.player_profile_id)
        .where(
            Registration.event_id == event.id,
            PlayerProfile.user_id == user_id,
        )
    )
    if registered is not None:
        return True
    if event.table_match_id is None:
        return False
    eligible = session.scalar(
        select(TableMatchPlayer.table_match_id)
        .join(
            PlayerDemandSignal,
            PlayerDemandSignal.id == TableMatchPlayer.player_demand_signal_id,
        )
        .join(PlayerProfile, PlayerProfile.id == PlayerDemandSignal.player_profile_id)
        .where(
            TableMatchPlayer.table_match_id == event.table_match_id,
            PlayerProfile.user_id == user_id,
        )
    )
    return eligible is not None


__all__ = ["event_access_query", "event_viewer_roles", "user_roles"]
