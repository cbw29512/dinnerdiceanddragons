"""Release forming Table commitments without ejecting established members."""

import logging
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.event import Event, EventStatus
from app.models.game_table_player import GameTablePlayer, GameTablePlayerStatus
from app.models.registration import Registration, RegistrationStatus

LOGGER = logging.getLogger(__name__)


def release_unestablished_membership(
    session: Session,
    event: Event,
    player_profile_id: UUID,
) -> None:
    """Revert a pre-first-play commitment when no other confirmed session remains."""

    try:
        if event.game_table_id is None:
            return
        membership = session.get(
            GameTablePlayer,
            (event.game_table_id, player_profile_id),
        )
        if (
            membership is None
            or membership.status != GameTablePlayerStatus.CONFIRMED.value
        ):
            return

        completed_event_id = session.scalar(
            select(Event.id)
            .where(
                Event.game_table_id == event.game_table_id,
                Event.status == EventStatus.COMPLETED.value,
            )
            .limit(1)
        )
        if completed_event_id is not None:
            return

        other_confirmed_event_id = session.scalar(
            select(Event.id)
            .join(Registration, Registration.event_id == Event.id)
            .where(
                Event.game_table_id == event.game_table_id,
                Event.id != event.id,
                Registration.player_profile_id == player_profile_id,
                Registration.status == RegistrationStatus.CONFIRMED.value,
            )
            .limit(1)
        )
        if other_confirmed_event_id is not None:
            return

        membership.status = GameTablePlayerStatus.INVITED.value
        membership.responded_at = None
        membership.ended_at = None
        session.flush()
    except Exception:
        LOGGER.exception(
            "Failed to release unestablished membership "
            "event_id=%s player_profile_id=%s",
            event.id,
            player_profile_id,
        )
        raise


__all__ = ["release_unestablished_membership"]
