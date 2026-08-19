"""Role-scoped query construction for persisted Table Match opportunities."""

from uuid import UUID

from sqlalchemy import Select, or_, select
from sqlalchemy.orm import Session

from app.models.game_system import GameSystem
from app.models.gm_profile import GMProfile
from app.models.gm_supply_signal import GMSupplySignal
from app.models.player_demand_signal import PlayerDemandSignal
from app.models.player_profile import PlayerProfile
from app.models.table_match import TableMatch, TableMatchStatus
from app.models.table_match_player import TableMatchPlayer, TableMatchPlayerStatus
from app.models.user_role import UserRole, UserRoleType
from app.models.venue import Venue, VenueManager
from app.models.venue_table_window import VenueTableWindow

VISIBLE_MATCH_STATUSES = (
    TableMatchStatus.POTENTIAL.value,
    TableMatchStatus.INVITED.value,
    TableMatchStatus.FORMING.value,
    TableMatchStatus.CONVERTED.value,
)
VISIBLE_PLAYER_STATUSES = (
    TableMatchPlayerStatus.ELIGIBLE.value,
    TableMatchPlayerStatus.NOTIFIED.value,
    TableMatchPlayerStatus.INTERESTED.value,
    TableMatchPlayerStatus.COMMITTED.value,
)


def user_roles(session: Session, user_id: UUID) -> frozenset[str]:
    """Return durable DDD role keys for one authenticated User."""

    return frozenset(
        session.scalars(select(UserRole.role).where(UserRole.user_id == user_id)).all()
    )


def opportunity_query(user_id: UUID, roles: frozenset[str]) -> Select:
    """Build a query that returns only relevant opportunities related to the caller."""

    conditions = []
    if UserRoleType.PLAYER.value in roles:
        conditions.append(
            TableMatch.id.in_(
                select(TableMatchPlayer.table_match_id)
                .join(
                    PlayerDemandSignal,
                    PlayerDemandSignal.id == TableMatchPlayer.player_demand_signal_id,
                )
                .join(PlayerProfile, PlayerProfile.id == PlayerDemandSignal.player_profile_id)
                .where(
                    PlayerProfile.user_id == user_id,
                    TableMatchPlayer.status.in_(VISIBLE_PLAYER_STATUSES),
                )
            )
        )
    if UserRoleType.GM.value in roles:
        conditions.append(
            TableMatch.gm_supply_signal_id.in_(
                select(GMSupplySignal.id)
                .join(GMProfile, GMProfile.id == GMSupplySignal.gm_profile_id)
                .where(GMProfile.user_id == user_id)
            )
        )
    if UserRoleType.VENUE_MANAGER.value in roles:
        conditions.append(
            TableMatch.venue_table_window_id.in_(
                select(VenueTableWindow.id)
                .join(VenueManager, VenueManager.venue_id == VenueTableWindow.venue_id)
                .where(
                    VenueManager.user_id == user_id,
                    VenueManager.verified_at.is_not(None),
                )
            )
        )

    access_filter = or_(*conditions) if conditions else TableMatch.id.is_(None)
    return (
        select(TableMatch, GameSystem, Venue)
        .join(GameSystem, GameSystem.id == TableMatch.game_system_id)
        .join(VenueTableWindow, VenueTableWindow.id == TableMatch.venue_table_window_id)
        .join(Venue, Venue.id == VenueTableWindow.venue_id)
        .where(
            access_filter,
            TableMatch.status.in_(VISIBLE_MATCH_STATUSES),
        )
    )


__all__ = ["opportunity_query", "user_roles"]
