"""Shared persistence and authorization helpers for Step 3 matching inputs."""

import logging
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.api.dependencies.venue_access import (
    VenueManagerRelationship,
    require_verified_venue_relationship,
)
from app.models.game_system import GameSystem
from app.models.gm_profile import GMProfile
from app.models.player_profile import PlayerProfile
from app.models.user import User
from app.models.venue import VenueManager

LOGGER = logging.getLogger(__name__)


class MatchingSignalValidationError(ValueError):
    """Submitted matching-signal state is invalid for DDD policy."""


class MatchingSignalConflictError(RuntimeError):
    """The authenticated account is missing required production state."""


class MatchingSignalPersistenceError(RuntimeError):
    """A database operation failed while handling matching input."""


def resolve_active_system(session: Session, slug: str) -> GameSystem:
    """Resolve one canonical active GameSystem by public slug."""

    try:
        system = session.scalar(
            select(GameSystem).where(
                GameSystem.slug == slug,
                GameSystem.active.is_(True),
            )
        )
    except SQLAlchemyError as exc:
        LOGGER.exception("Failed to resolve matching GameSystem slug %s", slug)
        raise MatchingSignalPersistenceError("Game system lookup failed.") from exc

    if system is None:
        raise MatchingSignalValidationError(f"Unknown or inactive game system slug: {slug}.")
    return system


def require_player_profile(session: Session, user: User) -> PlayerProfile:
    """Load the Player profile owned by the authenticated DDD User."""

    try:
        profile = session.scalar(select(PlayerProfile).where(PlayerProfile.user_id == user.id))
    except SQLAlchemyError as exc:
        LOGGER.exception("Failed to load PlayerProfile for user %s", user.id)
        raise MatchingSignalPersistenceError("Player profile lookup failed.") from exc

    if profile is None:
        raise MatchingSignalConflictError("Complete Player onboarding before creating demand.")
    return profile


def require_gm_profile(session: Session, user: User) -> GMProfile:
    """Load the GM profile owned by the authenticated DDD User."""

    try:
        profile = session.scalar(select(GMProfile).where(GMProfile.user_id == user.id))
    except SQLAlchemyError as exc:
        LOGGER.exception("Failed to load GMProfile for user %s", user.id)
        raise MatchingSignalPersistenceError("GM profile lookup failed.") from exc

    if profile is None:
        raise MatchingSignalConflictError("Complete GM onboarding before creating supply.")
    return profile


def require_verified_venue_manager(
    session: Session,
    user: User,
    venue_id: UUID,
) -> VenueManager:
    """Load and enforce one server-owned verified User-to-Venue relationship."""

    try:
        manager = session.scalar(
            select(VenueManager).where(
                VenueManager.venue_id == venue_id,
                VenueManager.user_id == user.id,
            )
        )
    except SQLAlchemyError as exc:
        LOGGER.exception(
            "Failed to load VenueManager relationship for user %s venue %s",
            user.id,
            venue_id,
        )
        raise MatchingSignalPersistenceError("Venue relationship lookup failed.") from exc

    if manager is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account cannot operate the requested venue.",
        )

    require_verified_venue_relationship(
        user,
        VenueManagerRelationship(
            venue_id=manager.venue_id,
            user_id=manager.user_id,
            verified_at=manager.verified_at,
        ),
        venue_id,
    )
    return manager
