"""Locked, revalidated context loading for TableMatch formation."""

from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.game_system import GameSystem
from app.models.gm_profile import GMProfile
from app.models.gm_supply_signal import GMSupplySignal
from app.models.matching_signal import SignalStatus
from app.models.table_match import TableMatch
from app.models.user import AccountStatus, User
from app.models.user_role import UserRole, UserRoleType
from app.models.venue import Venue
from app.models.venue_table_window import VenueTableWindow
from app.services.table_formation_errors import (
    TableFormationConflictError,
    TableFormationForbiddenError,
    TableFormationNotFoundError,
)


@dataclass(frozen=True, slots=True)
class FormationMatchContext:
    """Production records required to convert one TableMatch safely."""

    match: TableMatch
    gm_supply: GMSupplySignal
    gm_profile: GMProfile
    venue_window: VenueTableWindow
    venue: Venue
    game_system: GameSystem


def load_formation_match_context(
    session: Session,
    *,
    table_match_id: UUID,
    caller_user_id: UUID,
) -> FormationMatchContext:
    """Lock and revalidate one GM-owned TableMatch before conversion."""

    _require_role(session, caller_user_id, UserRoleType.GM.value)
    row = session.execute(
        select(
            TableMatch,
            GMSupplySignal,
            GMProfile,
            VenueTableWindow,
            Venue,
            GameSystem,
            User,
        )
        .join(GMSupplySignal, GMSupplySignal.id == TableMatch.gm_supply_signal_id)
        .join(GMProfile, GMProfile.id == GMSupplySignal.gm_profile_id)
        .join(User, User.id == GMProfile.user_id)
        .join(VenueTableWindow, VenueTableWindow.id == TableMatch.venue_table_window_id)
        .join(Venue, Venue.id == VenueTableWindow.venue_id)
        .join(GameSystem, GameSystem.id == TableMatch.game_system_id)
        .where(TableMatch.id == table_match_id)
        .with_for_update()
    ).one_or_none()
    if row is None:
        raise TableFormationNotFoundError("Table Match is not available.")

    match, supply, gm_profile, venue_window, venue, game_system, gm_user = row
    if gm_profile.user_id != caller_user_id:
        raise TableFormationNotFoundError("Table Match is not available.")
    if gm_user.status != AccountStatus.ACTIVE.value:
        raise TableFormationForbiddenError("GM account is not eligible to form a table.")
    if supply.status != SignalStatus.ACTIVE.value:
        raise TableFormationConflictError("GM supply is no longer active.")
    if not game_system.active or supply.game_system_id != match.game_system_id:
        raise TableFormationConflictError("Game system state changed; rerun matching.")
    if not venue_window.active or not venue.active or not venue.verified:
        raise TableFormationConflictError("Venue is no longer eligible for formation.")

    player_capacity = max(venue_window.max_people_per_table - 1, 0)
    current_maximum = min(supply.maximum_players, player_capacity)
    if (
        match.minimum_players != supply.minimum_players
        or match.maximum_players != current_maximum
        or current_maximum < supply.minimum_players
    ):
        raise TableFormationConflictError("GM or Venue capacity changed; rerun matching.")

    proposed_start = match.proposed_start
    if proposed_start.tzinfo is None:
        proposed_start = proposed_start.replace(tzinfo=UTC)
    if proposed_start.astimezone(UTC) <= datetime.now(UTC):
        raise TableFormationConflictError("Table Match occurrence is no longer in the future.")

    return FormationMatchContext(
        match=match,
        gm_supply=supply,
        gm_profile=gm_profile,
        venue_window=venue_window,
        venue=venue,
        game_system=game_system,
    )


def _require_role(session: Session, user_id: UUID, role: str) -> None:
    role_exists = session.scalar(
        select(UserRole.user_id).where(
            UserRole.user_id == user_id,
            UserRole.role == role,
        )
    )
    if role_exists is None:
        raise TableFormationForbiddenError("Required durable role is missing.")


__all__ = ["FormationMatchContext", "load_formation_match_context"]
