"""Authenticated Player demand-signal creation and owner listing."""

import logging

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.models.game_system import GameSystem
from app.models.player_demand_signal import PlayerDemandSignal
from app.models.user import User
from app.schemas.matching_signals import PlayerDemandCreate, PlayerDemandResponse
from app.services.matching_signal_common import (
    MatchingSignalConflictError,
    MatchingSignalPersistenceError,
    MatchingSignalValidationError,
    require_player_profile,
    resolve_active_system,
)

LOGGER = logging.getLogger(__name__)


def _optional_text(value: str | None) -> str | None:
    return value or None


def _response(signal: PlayerDemandSignal, slug: str) -> PlayerDemandResponse:
    return PlayerDemandResponse(
        id=signal.id,
        status=signal.status,
        system_slug=slug,
        preferred_format=signal.preferred_format,
        preferred_cadence=signal.preferred_cadence,
        minimum_age_preference=signal.minimum_age_preference,
        table_style_preferences=list(signal.table_style_preferences),
        environment_preferences=list(signal.environment_preferences),
    )


def create_player_demand(
    session: Session,
    user: User,
    payload: PlayerDemandCreate,
) -> PlayerDemandResponse:
    """Persist one Player-owned demand signal atomically."""

    try:
        profile = require_player_profile(session, user)
        system = resolve_active_system(session, payload.system_slug)
        signal = PlayerDemandSignal(
            player_profile_id=profile.id,
            game_system_id=system.id,
            preferred_format=payload.preferred_format.value,
            preferred_cadence=_optional_text(payload.preferred_cadence),
            minimum_age_preference=payload.minimum_age_preference,
            table_style_preferences=list(payload.table_style_preferences),
            environment_preferences=list(payload.environment_preferences),
        )
        session.add(signal)
        session.commit()
        LOGGER.info("Created Player demand %s for user %s", signal.id, user.id)
        return _response(signal, system.slug)
    except (MatchingSignalValidationError, MatchingSignalConflictError):
        session.rollback()
        raise
    except IntegrityError as exc:
        session.rollback()
        LOGGER.warning("Player demand conflict for user %s", user.id, exc_info=True)
        raise MatchingSignalConflictError("Player demand conflicts with existing data.") from exc
    except SQLAlchemyError as exc:
        session.rollback()
        LOGGER.exception("Player demand database failure for user %s", user.id)
        raise MatchingSignalPersistenceError("Player demand could not be saved.") from exc
    except Exception as exc:
        session.rollback()
        LOGGER.exception("Unexpected Player demand failure for user %s", user.id)
        raise MatchingSignalPersistenceError("Player demand could not be saved.") from exc


def list_player_demands(session: Session, user: User) -> list[PlayerDemandResponse]:
    """Return only demand signals owned by the authenticated Player."""

    try:
        profile = require_player_profile(session, user)
        rows = session.execute(
            select(PlayerDemandSignal, GameSystem.slug)
            .join(GameSystem, GameSystem.id == PlayerDemandSignal.game_system_id)
            .where(PlayerDemandSignal.player_profile_id == profile.id)
            .order_by(PlayerDemandSignal.created_at.desc(), PlayerDemandSignal.id)
        ).all()
        return [_response(signal, slug) for signal, slug in rows]
    except (MatchingSignalValidationError, MatchingSignalConflictError):
        raise
    except SQLAlchemyError as exc:
        LOGGER.exception("Failed to list Player demands for user %s", user.id)
        raise MatchingSignalPersistenceError("Player demands could not be loaded.") from exc
