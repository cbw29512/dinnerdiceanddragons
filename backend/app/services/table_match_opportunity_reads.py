"""Role-scoped reads for persisted Table Match opportunities."""

import logging
from dataclasses import dataclass
from decimal import Decimal
from uuid import UUID

from sqlalchemy import Select, or_, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.models.game_system import GameSystem
from app.models.gm_profile import GMProfile
from app.models.gm_supply_signal import GMSupplySignal
from app.models.match_explanation import MatchExplanation
from app.models.player_demand_signal import PlayerDemandSignal
from app.models.player_profile import PlayerProfile
from app.models.table_match import TableMatch
from app.models.table_match_player import TableMatchPlayer
from app.models.user import User
from app.models.user_role import UserRole, UserRoleType
from app.models.venue import Venue, VenueManager
from app.models.venue_table_window import VenueTableWindow
from app.schemas.table_match_opportunities import (
    OpportunityExplanationResponse,
    OpportunitySystemResponse,
    OpportunityVenueResponse,
    TableMatchOpportunityDetailResponse,
    TableMatchOpportunityResponse,
)

LOGGER = logging.getLogger(__name__)


class TableMatchOpportunityNotFoundError(LookupError):
    """The requested opportunity is absent or inaccessible to the caller."""


class TableMatchOpportunityReadError(RuntimeError):
    """Persisted opportunity data could not be loaded safely."""


@dataclass(frozen=True, slots=True)
class ViewerFacts:
    """Caller-specific context for one persisted match."""

    roles: tuple[str, ...]
    player_distance_miles: float | None
    gm_distance_miles: float | None
    player_fit_flags: tuple[str, ...]
    player_overlap: dict[str, str] | None


def list_opportunities(session: Session, user: User) -> list[TableMatchOpportunityResponse]:
    """Return only matches reachable through the caller's durable DDD roles."""

    try:
        roles = _user_roles(session, user.id)
        rows = session.execute(_base_query(user.id, roles).order_by(TableMatch.proposed_start)).all()
        return [_summary_response(session, user.id, roles, *row) for row in rows]
    except SQLAlchemyError as exc:
        LOGGER.exception("Failed to list role-safe Table Match opportunities")
        raise TableMatchOpportunityReadError("Matching opportunities could not be loaded.") from exc


def get_opportunity(
    session: Session,
    user: User,
    table_match_id: UUID,
) -> TableMatchOpportunityDetailResponse:
    """Return one explainable match only when the caller has resource access."""

    try:
        roles = _user_roles(session, user.id)
        row = session.execute(
            _base_query(user.id, roles).where(TableMatch.id == table_match_id)
        ).one_or_none()
        if row is None:
            raise TableMatchOpportunityNotFoundError("Matching opportunity was not found.")

        summary = _summary_response(session, user.id, roles, *row)
        viewer = _viewer_facts(session, user.id, roles, row[0])
        explanations = session.scalars(
            select(MatchExplanation)
            .where(MatchExplanation.table_match_id == table_match_id)
            .order_by(MatchExplanation.criterion)
        ).all()
        return TableMatchOpportunityDetailResponse(
            **summary.model_dump(),
            your_player_fit_flags=list(viewer.player_fit_flags),
            your_player_availability_overlap=viewer.player_overlap,
            explanations=[
                OpportunityExplanationResponse(
                    criterion=item.criterion,
                    result=item.result,
                    summary=item.summary,
                )
                for item in explanations
            ],
        )
    except TableMatchOpportunityNotFoundError:
        raise
    except SQLAlchemyError as exc:
        LOGGER.exception("Failed to load role-safe Table Match opportunity %s", table_match_id)
        raise TableMatchOpportunityReadError("Matching opportunity could not be loaded.") from exc


def _base_query(user_id: UUID, roles: frozenset[str]) -> Select:
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
        .join(
            VenueTableWindow,
            VenueTableWindow.id == TableMatch.venue_table_window_id,
        )
        .join(Venue, Venue.id == VenueTableWindow.venue_id)
        .where(access_filter)
    )


def _summary_response(
    session: Session,
    user_id: UUID,
    roles: frozenset[str],
    match: TableMatch,
    system: GameSystem,
    venue: Venue,
) -> TableMatchOpportunityResponse:
    viewer = _viewer_facts(session, user_id, roles, match)
    return TableMatchOpportunityResponse(
        id=match.id,
        status=match.status,
        proposed_start=match.proposed_start,
        proposed_end=match.proposed_end,
        timezone=match.timezone,
        minimum_players=match.minimum_players,
        maximum_players=match.maximum_players,
        compatible_player_count=match.compatible_player_count,
        system=OpportunitySystemResponse(
            slug=system.slug,
            name=system.name,
            edition=system.edition,
        ),
        venue=OpportunityVenueResponse(
            id=venue.id,
            name=venue.name,
            city=venue.city,
            state_region=venue.state_region,
        ),
        viewer_roles=list(viewer.roles),
        your_player_distance_miles=viewer.player_distance_miles,
        your_gm_distance_miles=viewer.gm_distance_miles,
    )


def _viewer_facts(
    session: Session,
    user_id: UUID,
    roles: frozenset[str],
    match: TableMatch,
) -> ViewerFacts:
    viewer_roles: list[str] = []
    player_distance: float | None = None
    player_flags: tuple[str, ...] = ()
    player_overlap: dict[str, str] | None = None

    if UserRoleType.PLAYER.value in roles:
        player_row = session.execute(
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
        ).scalar_one_or_none()
        if player_row is not None:
            viewer_roles.append(UserRoleType.PLAYER.value)
            player_distance = _decimal_to_float(player_row.distance_miles)
            player_flags = tuple(str(item) for item in player_row.fit_flags)
            player_overlap = {
                str(key): str(value)
                for key, value in player_row.availability_overlap.items()
            }

    gm_distance: float | None = None
    if UserRoleType.GM.value in roles:
        owns_gm = session.scalar(
            select(GMSupplySignal.id)
            .join(GMProfile, GMProfile.id == GMSupplySignal.gm_profile_id)
            .where(
                GMSupplySignal.id == match.gm_supply_signal_id,
                GMProfile.user_id == user_id,
            )
        )
        if owns_gm is not None:
            viewer_roles.append(UserRoleType.GM.value)
            raw_distance = match.distance_summary.get("gm_miles")
            if isinstance(raw_distance, (int, float)) and not isinstance(raw_distance, bool):
                gm_distance = float(raw_distance)

    if UserRoleType.VENUE_MANAGER.value in roles:
        managed = session.scalar(
            select(VenueManager.id)
            .join(Venue, Venue.id == VenueManager.venue_id)
            .join(VenueTableWindow, VenueTableWindow.venue_id == Venue.id)
            .where(
                VenueTableWindow.id == match.venue_table_window_id,
                VenueManager.user_id == user_id,
                VenueManager.verified_at.is_not(None),
            )
        )
        if managed is not None:
            viewer_roles.append(UserRoleType.VENUE_MANAGER.value)

    return ViewerFacts(
        roles=tuple(viewer_roles),
        player_distance_miles=player_distance,
        gm_distance_miles=gm_distance,
        player_fit_flags=player_flags,
        player_overlap=player_overlap,
    )


def _user_roles(session: Session, user_id: UUID) -> frozenset[str]:
    return frozenset(
        session.scalars(select(UserRole.role).where(UserRole.user_id == user_id)).all()
    )


def _decimal_to_float(value: Decimal | float | int) -> float:
    return float(value)


__all__ = [
    "TableMatchOpportunityNotFoundError",
    "TableMatchOpportunityReadError",
    "get_opportunity",
    "list_opportunities",
]
