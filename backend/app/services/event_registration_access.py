"""Authorization and eligibility helpers for Event registration mutations."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.event import Event
from app.models.gm_profile import GMProfile
from app.models.player_demand_signal import PlayerDemandSignal
from app.models.player_profile import PlayerProfile
from app.models.table_match_player import TableMatchPlayer, TableMatchPlayerStatus
from app.models.user import AccountStatus, User
from app.models.user_role import UserRole, UserRoleType
from app.services.table_formation_errors import (
    TableFormationForbiddenError,
    TableFormationNotFoundError,
)

MATCH_ELIGIBLE_PLAYER_STATUSES = {
    TableMatchPlayerStatus.ELIGIBLE.value,
    TableMatchPlayerStatus.NOTIFIED.value,
    TableMatchPlayerStatus.INTERESTED.value,
    TableMatchPlayerStatus.COMMITTED.value,
}


def require_event_player(
    session: Session,
    *,
    event: Event,
    caller_user_id: UUID,
) -> PlayerProfile:
    """Return the active caller's Player profile after matcher eligibility checks."""

    profile = session.scalar(
        select(PlayerProfile)
        .join(User, User.id == PlayerProfile.user_id)
        .join(
            UserRole,
            (UserRole.user_id == User.id)
            & (UserRole.role == UserRoleType.PLAYER.value),
        )
        .where(
            PlayerProfile.user_id == caller_user_id,
            User.status == AccountStatus.ACTIVE.value,
        )
    )
    if profile is None:
        raise TableFormationForbiddenError("Active Player access is required.")

    require_player_profile_eligible(session, event=event, player_profile_id=profile.id)
    return profile


def require_player_profile_eligible(
    session: Session,
    *,
    event: Event,
    player_profile_id: UUID,
) -> PlayerProfile:
    """Revalidate a registration Player before confirmation or waitlist promotion."""

    profile = session.scalar(
        select(PlayerProfile)
        .join(User, User.id == PlayerProfile.user_id)
        .join(
            UserRole,
            (UserRole.user_id == User.id)
            & (UserRole.role == UserRoleType.PLAYER.value),
        )
        .where(
            PlayerProfile.id == player_profile_id,
            User.status == AccountStatus.ACTIVE.value,
        )
    )
    if profile is None:
        raise TableFormationForbiddenError("Player is no longer eligible for this Event.")

    if event.table_match_id is not None:
        matched = session.scalar(
            select(TableMatchPlayer.table_match_id)
            .join(
                PlayerDemandSignal,
                PlayerDemandSignal.id == TableMatchPlayer.player_demand_signal_id,
            )
            .where(
                TableMatchPlayer.table_match_id == event.table_match_id,
                PlayerDemandSignal.player_profile_id == profile.id,
                TableMatchPlayer.status.in_(MATCH_ELIGIBLE_PLAYER_STATUSES),
            )
        )
        if matched is None:
            raise TableFormationNotFoundError("Event registration is not available.")

    return profile


def require_event_gm(
    session: Session,
    *,
    event: Event,
    caller_user_id: UUID,
) -> GMProfile:
    """Return the owning active GM profile for an Event mutation."""

    profile = session.scalar(
        select(GMProfile)
        .join(User, User.id == GMProfile.user_id)
        .join(
            UserRole,
            (UserRole.user_id == User.id) & (UserRole.role == UserRoleType.GM.value),
        )
        .where(
            GMProfile.id == event.gm_profile_id,
            GMProfile.user_id == caller_user_id,
            User.status == AccountStatus.ACTIVE.value,
        )
    )
    if profile is None:
        raise TableFormationNotFoundError("Event registration is not available.")
    return profile


__all__ = [
    "require_event_gm",
    "require_event_player",
    "require_player_profile_eligible",
]
