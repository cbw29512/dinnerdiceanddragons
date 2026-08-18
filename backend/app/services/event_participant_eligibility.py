"""Current Player eligibility checks for Event lifecycle mutations."""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.matching_signal import SignalStatus
from app.models.player_demand_signal import PlayerDemandSignal
from app.models.player_profile import PlayerProfile
from app.models.table_match_player import TableMatchPlayer, TableMatchPlayerStatus
from app.models.user import AccountStatus, User
from app.models.user_role import UserRole, UserRoleType

CURRENT_DEMAND_STATUSES = {
    SignalStatus.ACTIVE.value,
    SignalStatus.MATCHED.value,
}
CURRENT_MATCH_PLAYER_STATUSES = {
    TableMatchPlayerStatus.ELIGIBLE.value,
    TableMatchPlayerStatus.NOTIFIED.value,
    TableMatchPlayerStatus.INTERESTED.value,
    TableMatchPlayerStatus.COMMITTED.value,
}


def player_profile_is_currently_eligible(
    session: Session,
    *,
    table_match_id: UUID | None,
    player_profile_id: UUID,
) -> bool:
    """Return whether a Player remains eligible for this persisted Table Match."""

    if table_match_id is None:
        return False
    return (
        session.scalar(
            select(PlayerProfile.id)
            .join(User, User.id == PlayerProfile.user_id)
            .join(
                UserRole,
                (UserRole.user_id == User.id)
                & (UserRole.role == UserRoleType.PLAYER.value),
            )
            .join(
                PlayerDemandSignal,
                PlayerDemandSignal.player_profile_id == PlayerProfile.id,
            )
            .join(
                TableMatchPlayer,
                TableMatchPlayer.player_demand_signal_id == PlayerDemandSignal.id,
            )
            .where(
                PlayerProfile.id == player_profile_id,
                User.status == AccountStatus.ACTIVE.value,
                PlayerDemandSignal.status.in_(CURRENT_DEMAND_STATUSES),
                TableMatchPlayer.table_match_id == table_match_id,
                TableMatchPlayer.status.in_(CURRENT_MATCH_PLAYER_STATUSES),
            )
            .limit(1)
        )
        is not None
    )


def current_eligible_player_count(session: Session, *, table_match_id: UUID) -> int:
    """Count currently eligible Players without trusting the stored compatibility count."""

    return int(
        session.scalar(
            select(func.count(func.distinct(PlayerProfile.id)))
            .select_from(PlayerProfile)
            .join(User, User.id == PlayerProfile.user_id)
            .join(
                UserRole,
                (UserRole.user_id == User.id)
                & (UserRole.role == UserRoleType.PLAYER.value),
            )
            .join(
                PlayerDemandSignal,
                PlayerDemandSignal.player_profile_id == PlayerProfile.id,
            )
            .join(
                TableMatchPlayer,
                TableMatchPlayer.player_demand_signal_id == PlayerDemandSignal.id,
            )
            .where(
                User.status == AccountStatus.ACTIVE.value,
                PlayerDemandSignal.status.in_(CURRENT_DEMAND_STATUSES),
                TableMatchPlayer.table_match_id == table_match_id,
                TableMatchPlayer.status.in_(CURRENT_MATCH_PLAYER_STATUSES),
            )
        )
        or 0
    )


__all__ = [
    "CURRENT_DEMAND_STATUSES",
    "CURRENT_MATCH_PLAYER_STATUSES",
    "current_eligible_player_count",
    "player_profile_is_currently_eligible",
]
