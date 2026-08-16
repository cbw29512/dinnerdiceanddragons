"""Ownership checks for Player and GM availability resources."""

import logging

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.api.dependencies.ownership import require_profile_owner
from app.models.availability_window import GMAvailabilityWindow, PlayerAvailabilityWindow
from app.models.gm_profile import GMProfile
from app.models.player_profile import PlayerProfile
from app.models.user import User

logger = logging.getLogger(__name__)


def require_player_availability_owner(
    actor: User,
    window: PlayerAvailabilityWindow,
    session: Session,
) -> User:
    """Authorize a Player window through its server-loaded parent profile."""

    try:
        owner_user_id = session.scalar(
            select(PlayerProfile.user_id).where(PlayerProfile.id == window.player_profile_id)
        )
    except SQLAlchemyError as exc:
        logger.exception(
            "Failed to resolve Player availability owner for window %s",
            window.id,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Availability ownership could not be verified.",
        ) from exc

    if owner_user_id is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Player availability owner was not found.",
        )

    return require_profile_owner(actor, owner_user_id)


def require_gm_availability_owner(
    actor: User,
    window: GMAvailabilityWindow,
    session: Session,
) -> User:
    """Authorize a GM window through its server-loaded parent profile."""

    try:
        owner_user_id = session.scalar(
            select(GMProfile.user_id).where(GMProfile.id == window.gm_profile_id)
        )
    except SQLAlchemyError as exc:
        logger.exception(
            "Failed to resolve GM availability owner for window %s",
            window.id,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Availability ownership could not be verified.",
        ) from exc

    if owner_user_id is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="GM availability owner was not found.",
        )

    return require_profile_owner(actor, owner_user_id)
