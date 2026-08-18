"""Resource-level authorization facts for persisted Table Match opportunities."""

from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import Select, or_, select
from sqlalchemy.orm import Session

from app.models.game_system import GameSystem
from app.models.gm_profile import GMProfile
from app.models.gm_supply_signal import GMSupplySignal
from app.models.player_demand_signal import PlayerDemandSignal
from app.models.player_profile import PlayerProfile
from app.models.table_match import TableMatch
from app.models.table_match_player import TableMatchPlayer
from app.models.user_role import UserRole, UserRoleType
from app.models.venue import Venue, VenueManager
from app.models.venue_table_window import VenueTableWindow


@dataclass(frozen=True, slots=True)
class ViewerFacts:
    """Caller-specific context for one persisted match."""

    roles: tuple[str, ...]
    player_distance_miles: float | None
    gm_distance_miles: float | None
    player_fit_flags: tuple[str, ...]
    player_overlap: dict[str, str] | None


def user_roles(session: Session, user_id: UUID) -> frozenset[str]:
    """Return durable DDD role keys for one authenticated User."""

    return frozenset(
        session.scalars(select(UserRole.role).where(UserRole.user_id == user_id)).all()
    )


def opportunity_query(user_id: UUID, roles: frozenset[str]) -> Select:
    """Build a query that cannot return matches unrelated to the caller."""

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
                .where(PlayerProfile.user_id == user_id)
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
        .where(access_filter)
    )


def viewer_facts(
    session: Session,
    user_id: UUID,
    roles: frozenset[str],
    match: TableMatch,
) -> ViewerFacts:
    """Return only the caller's own distance/fit context for one match."""

    viewer_roles: list[str] = []
    player_rows = []
    if UserRoleType.PLAYER.value in roles:
        player_rows = session.scalars(
            select(TableMatchPlayer)
            .join(
                PlayerDemandSignal,
                PlayerDemandSignal.id == TableMatchPlayer.player_demand_signal_id,
            )
            .join(PlayerProfile, PlayerProfile.id == PlayerDemandSignal.player_profile_id)
            .where(
                TableMatchPlayer.table_match_id == match.id,
                PlayerProfile.user_id == user_id,
            )
            .order_by(TableMatchPlayer.player_demand_signal_id)
        ).all()

    player_row = player_rows[0] if player_rows else None
    if player_row is not None:
        viewer_roles.append(UserRoleType.PLAYER.value)

    gm_distance: float | None = None
    if UserRoleType.GM.value in roles and _owns_gm_match(session, user_id, match):
        viewer_roles.append(UserRoleType.GM.value)
        raw_distance = match.distance_summary.get("gm_miles")
        if isinstance(raw_distance, (int, float)) and not isinstance(raw_distance, bool):
            gm_distance = float(raw_distance)

    if UserRoleType.VENUE_MANAGER.value in roles and _manages_match_venue(
        session, user_id, match
    ):
        viewer_roles.append(UserRoleType.VENUE_MANAGER.value)

    return ViewerFacts(
        roles=tuple(viewer_roles),
        player_distance_miles=(float(player_row.distance_miles) if player_row else None),
        gm_distance_miles=gm_distance,
        player_fit_flags=(tuple(str(item) for item in player_row.fit_flags) if player_row else ()),
        player_overlap=(
            {str(key): str(value) for key, value in player_row.availability_overlap.items()}
            if player_row
            else None
        ),
    )


def _owns_gm_match(session: Session, user_id: UUID, match: TableMatch) -> bool:
    return (
        session.scalar(
            select(GMSupplySignal.id)
            .join(GMProfile, GMProfile.id == GMSupplySignal.gm_profile_id)
            .where(
                GMSupplySignal.id == match.gm_supply_signal_id,
                GMProfile.user_id == user_id,
            )
        )
        is not None
    )


def _manages_match_venue(session: Session, user_id: UUID, match: TableMatch) -> bool:
    return (
        session.scalar(
            select(VenueManager.id)
            .join(VenueTableWindow, VenueTableWindow.venue_id == VenueManager.venue_id)
            .where(
                VenueTableWindow.id == match.venue_table_window_id,
                VenueManager.user_id == user_id,
                VenueManager.verified_at.is_not(None),
            )
        )
        is not None
    )


__all__ = ["ViewerFacts", "opportunity_query", "user_roles", "viewer_facts"]
