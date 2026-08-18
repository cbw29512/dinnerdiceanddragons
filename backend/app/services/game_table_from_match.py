"""Create or refresh a persistent GameTable from one fully viable TableMatch."""

import logging
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.event import EventJoinMode
from app.models.game_system import GameSystem
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


def materialize_game_table_from_match(
    session: Session,
    match: TableMatch,
    parents: FormationParents,
) -> GameTable:
    """Create/reuse the persistent BOOM-stage Table without inventing commitments."""

    try:
        supply = session.get(GMSupplySignal, match.gm_supply_signal_id)
        if supply is None:
            raise FormationConflictError("Matched GM supply no longer exists.")

        game_table = session.scalar(
            select(GameTable).where(GameTable.source_table_match_id == match.id)
        )
        if game_table is None:
            game_table = GameTable(
                game_system_id=match.game_system_id,
                created_by_user_id=parents.gm.user_id,
                source_table_match_id=match.id,
                title=_generated_title(session, match),
                lifecycle_status=GameTableStatus.FORMING.value,
                game_format=supply.preferred_format,
                minimum_players=match.minimum_players,
                maximum_players=match.maximum_players,
                join_policy=GameTableJoinPolicy.REQUEST.value,
                table_style=supply.table_style,
                gm_profile_id=parents.gm.id,
                venue_id=parents.window.venue_id,
                venue_table_window_id=parents.window.id,
                proposed_start=match.proposed_start,
                proposed_end=match.proposed_end,
                timezone=match.timezone,
            )
            session.add(game_table)
            session.flush()
        elif game_table.lifecycle_status in {
            GameTableStatus.DRAFT.value,
            GameTableStatus.FORMING.value,
            GameTableStatus.READY.value,
        }:
            # A refreshed potential match may tighten capacity or other hard-fit
            # facts. Do not rewrite a Table once scheduled play is confirmed.
            game_table.game_system_id = match.game_system_id
            game_table.game_format = supply.preferred_format
            game_table.minimum_players = match.minimum_players
            game_table.maximum_players = match.maximum_players
            game_table.table_style = supply.table_style
            game_table.gm_profile_id = parents.gm.id
            game_table.venue_id = parents.window.venue_id
            game_table.venue_table_window_id = parents.window.id
            game_table.proposed_start = match.proposed_start
            game_table.proposed_end = match.proposed_end
            game_table.timezone = match.timezone

        _sync_player_invitations(session, game_table, match)
        session.flush()
        return game_table
    except FormationConflictError:
        raise
    except Exception:
        LOGGER.exception("Failed to materialize GameTable from TableMatch %s", match.id)
        raise


def create_game_table_from_match(
    session: Session,
    match: TableMatch,
    parents: FormationParents,
    payload: FormTableMatchRequest,
) -> GameTable:
    """Finalize human-authored Table presentation during Event formation."""

    game_table = materialize_game_table_from_match(session, match, parents)
    game_table.title = payload.title.strip()
    game_table.join_policy = (
        GameTableJoinPolicy.OPEN.value
        if payload.join_mode == EventJoinMode.INSTANT_JOIN
        else GameTableJoinPolicy.REQUEST.value
    )
    game_table.minimum_age = payload.minimum_age
    session.flush()
    return game_table


def _generated_title(session: Session, match: TableMatch) -> str:
    system = session.get(GameSystem, match.game_system_id)
    system_name = system.name if system is not None else "Tabletop RPG"
    local_date = match.proposed_start.date().isoformat()
    return f"{system_name} — {local_date}"[:200]


def _sync_player_invitations(
    session: Session,
    game_table: GameTable,
    match: TableMatch,
) -> None:
    """Mirror current compatible Players without overriding human commitments."""

    invitations = _current_player_invitations(session, match)
    existing = {
        membership.player_profile_id: membership
        for membership in session.scalars(
            select(GameTablePlayer).where(GameTablePlayer.game_table_id == game_table.id)
        ).all()
    }

    for player_profile_id, demand_id in invitations.items():
        membership = existing.get(player_profile_id)
        if membership is None:
            session.add(
                GameTablePlayer(
                    game_table_id=game_table.id,
                    player_profile_id=player_profile_id,
                    source_player_demand_signal_id=demand_id,
                    status=GameTablePlayerStatus.INVITED.value,
                )
            )
        elif membership.status == GameTablePlayerStatus.INVITED.value:
            membership.source_player_demand_signal_id = demand_id

    now = datetime.now(UTC)
    eligible_ids = set(invitations)
    for player_profile_id, membership in existing.items():
        if (
            player_profile_id not in eligible_ids
            and membership.status == GameTablePlayerStatus.INVITED.value
        ):
            membership.status = GameTablePlayerStatus.REMOVED.value
            membership.ended_at = now


def _current_player_invitations(
    session: Session,
    match: TableMatch,
) -> dict[UUID, UUID]:
    """Return one current demand signal per eligible Player for the match."""

    rows = session.execute(
        select(PlayerProfile.id, PlayerDemandSignal.id)
        .join(User, User.id == PlayerProfile.user_id)
        .join(
            UserRole,
            (UserRole.user_id == User.id) & (UserRole.role == UserRoleType.PLAYER.value),
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
            TableMatchPlayer.table_match_id == match.id,
            TableMatchPlayer.status.in_(CURRENT_MATCH_PLAYER_STATUSES),
        )
        .order_by(PlayerProfile.id, PlayerDemandSignal.id)
    ).all()
    return {player_profile_id: demand_id for player_profile_id, demand_id in rows}


__all__ = ["create_game_table_from_match", "materialize_game_table_from_match"]
