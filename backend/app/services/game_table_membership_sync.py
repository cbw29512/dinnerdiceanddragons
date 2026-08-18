"""Synchronize confirmed Event seats into persistent GameTable membership."""

import logging
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.event import Event
from app.models.game_table import GameTable
from app.models.game_table_player import GameTablePlayer, GameTablePlayerStatus
from app.models.player_demand_signal import PlayerDemandSignal
from app.models.table_match_player import TableMatchPlayer
from app.services.registration_common import RegistrationConflictError

LOGGER = logging.getLogger(__name__)
CLOSED_MEMBERSHIP_STATUSES = {
    GameTablePlayerStatus.REMOVED.value,
    GameTablePlayerStatus.LEFT.value,
}


def confirm_game_table_membership(
    session: Session,
    event: Event,
    player_profile_id: UUID,
) -> GameTablePlayer | None:
    """Promote a confirmed Event participant when durable roster capacity exists."""

    try:
        if event.game_table_id is None:
            return None

        game_table = session.scalar(
            select(GameTable)
            .where(GameTable.id == event.game_table_id)
            .with_for_update()
        )
        if game_table is None:
            raise RegistrationConflictError("Event is missing its persistent Table state.")

        membership = session.get(
            GameTablePlayer,
            (game_table.id, player_profile_id),
        )
        if (
            membership is not None
            and membership.status == GameTablePlayerStatus.CONFIRMED.value
        ):
            return membership
        if membership is not None and membership.status in CLOSED_MEMBERSHIP_STATUSES:
            raise RegistrationConflictError(
                "Player must rejoin the Table before taking a seat."
            )

        confirmed_members = int(
            session.scalar(
                select(func.count())
                .select_from(GameTablePlayer)
                .where(
                    GameTablePlayer.game_table_id == game_table.id,
                    GameTablePlayer.status == GameTablePlayerStatus.CONFIRMED.value,
                )
            )
            or 0
        )
        if confirmed_members >= game_table.maximum_players:
            if membership is None:
                membership = GameTablePlayer(
                    game_table_id=game_table.id,
                    player_profile_id=player_profile_id,
                    source_player_demand_signal_id=_source_demand_id(
                        session,
                        event,
                        player_profile_id,
                    ),
                    status=GameTablePlayerStatus.INVITED.value,
                )
                session.add(membership)
                session.flush()
            LOGGER.info(
                "Confirmed Event participant remains non-roster substitute "
                "table_id=%s player_profile_id=%s",
                game_table.id,
                player_profile_id,
            )
            return membership

        now = datetime.now(UTC)
        if membership is None:
            membership = GameTablePlayer(
                game_table_id=game_table.id,
                player_profile_id=player_profile_id,
                source_player_demand_signal_id=_source_demand_id(
                    session,
                    event,
                    player_profile_id,
                ),
                status=GameTablePlayerStatus.CONFIRMED.value,
                responded_at=now,
            )
            session.add(membership)
        else:
            membership.status = GameTablePlayerStatus.CONFIRMED.value
            membership.responded_at = now
            membership.ended_at = None

        session.flush()
        return membership
    except RegistrationConflictError:
        raise
    except Exception:
        LOGGER.exception(
            "Failed to synchronize GameTable membership "
            "event_id=%s player_profile_id=%s",
            event.id,
            player_profile_id,
        )
        raise


def _source_demand_id(
    session: Session,
    event: Event,
    player_profile_id: UUID,
) -> UUID | None:
    """Recover TableMatch demand provenance for a newly confirmed member."""

    if event.table_match_id is None:
        return None
    return session.scalar(
        select(PlayerDemandSignal.id)
        .join(
            TableMatchPlayer,
            TableMatchPlayer.player_demand_signal_id == PlayerDemandSignal.id,
        )
        .where(
            TableMatchPlayer.table_match_id == event.table_match_id,
            PlayerDemandSignal.player_profile_id == player_profile_id,
        )
        .order_by(PlayerDemandSignal.id)
        .limit(1)
    )


__all__ = ["confirm_game_table_membership"]
