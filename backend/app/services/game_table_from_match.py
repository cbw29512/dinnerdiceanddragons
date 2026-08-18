"""Create a persistent GameTable from one fully viable TableMatch."""

import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.event import EventJoinMode
from app.models.game_table import GameTable, GameTableJoinPolicy, GameTableStatus
from app.models.game_table_player import GameTablePlayer, GameTablePlayerStatus
from app.models.gm_supply_signal import GMSupplySignal
from app.models.player_demand_signal import PlayerDemandSignal
from app.models.player_profile import PlayerProfile
from app.models.table_match import TableMatch
from app.models.table_match_player import TableMatchPlayer
from app.models.user import AccountStatus, User
from app.models.user_role import UserRole, UserRoleType
from app.schemas.table_formation import FormTableMatchRequest
from app.services.event_participant_eligibility import (
    CURRENT_DEMAND_STATUSES,
    CURRENT_MATCH_PLAYER_STATUSES,
)
from app.services.table_formation_builders import FormationParents
from app.services.table_formation_errors import FormationConflictError

LOGGER = logging.getLogger(__name__)


def create_game_table_from_match(
    session: Session,
    match: TableMatch,
    parents: FormationParents,
    payload: FormTableMatchRequest,
) -> GameTable:
    """Persist Table identity plus invitations without inventing Player commitment."""

    try:
        supply = session.get(GMSupplySignal, match.gm_supply_signal_id)
        if supply is None:
            raise FormationConflictError("Matched GM supply no longer exists.")

        game_table = GameTable(
            game_system_id=match.game_system_id,
            created_by_user_id=parents.gm.user_id,
            source_table_match_id=match.id,
            title=payload.title.strip(),
            lifecycle_status=GameTableStatus.FORMING.value,
            game_format=supply.preferred_format,
            minimum_players=match.minimum_players,
            maximum_players=match.maximum_players,
            join_policy=(
                GameTableJoinPolicy.OPEN.value
                if payload.join_mode == EventJoinMode.INSTANT_JOIN
                else GameTableJoinPolicy.REQUEST.value
            ),
            table_style=supply.table_style,
            minimum_age=payload.minimum_age,
            gm_profile_id=parents.gm.id,
            venue_id=parents.window.venue_id,
            venue_table_window_id=parents.window.id,
            proposed_start=match.proposed_start,
            proposed_end=match.proposed_end,
            timezone=match.timezone,
        )
        session.add(game_table)
        session.flush()

        invitations = _current_player_invitations(session, match)
        session.add_all(
            GameTablePlayer(
                game_table_id=game_table.id,
                player_profile_id=player_profile_id,
                source_player_demand_signal_id=demand_id,
                status=GameTablePlayerStatus.INVITED.value,
            )
            for player_profile_id, demand_id in invitations.items()
        )
        session.flush()
        return game_table
    except FormationConflictError:
        raise
    except Exception:
        LOGGER.exception("Failed to create GameTable from TableMatch %s", match.id)
        raise


def _current_player_invitations(session: Session, match: TableMatch) -> dict:
    """Return one current demand signal per eligible Player for the match."""

    rows = session.execute(
        select(PlayerProfile.id, PlayerDemandSignal.id)
        .join(User, User.id == PlayerProfile.user_id)
        .join(
            UserRole,
            (UserRole.user_id == User.id) & (UserRole.role == UserRoleType.PLAYER.value),
        )
        .join(PlayerDemandSignal, PlayerDemandSignal.player_profile_id == PlayerProfile.id)
        .join(
            TableMatchPlayer,
            TableMatchPlayer.player_demand_signal_id == PlayerDemandSignal.id,
        )
        .where(
            User.status == AccountStatus.ACTIVE.value,
            PlayerDemandSignal.status.in_(CURRENT_DEMAND_STATUSES),
            TableMatchPlayer.table_match_id == match.id,
            TableMatchPlayer.status.in_(CURRENT_MATCH_PLAYER_STATUSES),
        )
        .order_by(PlayerProfile.id, PlayerDemandSignal.id)
    ).all()
    return {player_profile_id: demand_id for player_profile_id, demand_id in rows}


__all__ = ["create_game_table_from_match"]
