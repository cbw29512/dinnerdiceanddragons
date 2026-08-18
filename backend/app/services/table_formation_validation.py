"""Current-state revalidation before creating new Event formation state."""

from datetime import UTC, datetime

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
from app.services.event_participant_eligibility import current_eligible_player_count
from app.services.table_formation_errors import (
    FormationConflictError,
    FormationForbiddenError,
)


def validate_new_formation(
    session: Session,
    *,
    user: User,
    match: TableMatch,
) -> None:
    """Reject a stale Table Match when its source conditions no longer hold."""

    row = session.execute(
        select(
            GMSupplySignal,
            GMProfile,
            User,
            VenueTableWindow,
            Venue,
            GameSystem,
        )
        .select_from(GMSupplySignal)
        .join(GMProfile, GMProfile.id == GMSupplySignal.gm_profile_id)
        .join(User, User.id == GMProfile.user_id)
        .join(
            VenueTableWindow,
            VenueTableWindow.id == match.venue_table_window_id,
        )
        .join(Venue, Venue.id == VenueTableWindow.venue_id)
        .join(GameSystem, GameSystem.id == match.game_system_id)
        .where(GMSupplySignal.id == match.gm_supply_signal_id)
        .with_for_update()
    ).one_or_none()
    if row is None:
        raise FormationConflictError("Table Match source state is no longer available.")

    supply, gm, gm_user, window, venue, game_system = row
    if gm.user_id != user.id:
        raise FormationForbiddenError("Only the matched GM can form this table.")
    if gm_user.status != AccountStatus.ACTIVE.value:
        raise FormationForbiddenError("The matched GM account is no longer active.")

    gm_role = session.scalar(
        select(UserRole.user_id).where(
            UserRole.user_id == gm_user.id,
            UserRole.role == UserRoleType.GM.value,
        )
    )
    if gm_role is None:
        raise FormationForbiddenError("The matched GM role is no longer active.")

    if supply.status != SignalStatus.ACTIVE.value:
        raise FormationConflictError("GM supply is no longer active.")
    if supply.game_system_id != match.game_system_id:
        raise FormationConflictError("GM supply no longer matches the game system.")
    if (
        supply.minimum_players != match.minimum_players
        or supply.maximum_players != match.maximum_players
    ):
        raise FormationConflictError("GM Player bounds changed after matching; rerun matching.")

    if not game_system.active:
        raise FormationConflictError("Game system is no longer active.")
    if not window.active:
        raise FormationConflictError("Venue table availability is no longer active.")
    if not venue.active or not venue.verified:
        raise FormationConflictError("Venue is no longer eligible for formation.")
    if window.max_people_per_table < match.maximum_players + 1:
        raise FormationConflictError("Venue table capacity no longer supports this match.")

    proposed_start = match.proposed_start
    if proposed_start.tzinfo is None:
        proposed_start = proposed_start.replace(tzinfo=UTC)
    if proposed_start.astimezone(UTC) <= datetime.now(UTC):
        raise FormationConflictError("Table Match occurrence is no longer in the future.")

    if current_eligible_player_count(session, table_match_id=match.id) < match.minimum_players:
        raise FormationConflictError("Table Match no longer has enough currently eligible Players.")


__all__ = ["validate_new_formation"]
