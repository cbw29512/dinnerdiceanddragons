"""Authenticated GM supply-signal creation and owner listing."""

import logging

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.models.game_system import GameSystem
from app.models.gm_supply_signal import GMSupplySignal
from app.models.gm_system_experience import GMSystemExperience
from app.models.user import User
from app.schemas.matching_signals import GMSupplyCreate, GMSupplyResponse
from app.services.matching_signal_common import (
    MatchingSignalConflictError,
    MatchingSignalPersistenceError,
    MatchingSignalValidationError,
    require_gm_profile,
    resolve_active_system,
)

LOGGER = logging.getLogger(__name__)


def _response(signal: GMSupplySignal, slug: str) -> GMSupplyResponse:
    return GMSupplyResponse(
        id=signal.id,
        status=signal.status,
        system_slug=slug,
        preferred_format=signal.preferred_format,
        preferred_cadence=signal.preferred_cadence,
        minimum_players=signal.minimum_players,
        maximum_players=signal.maximum_players,
        table_style=signal.table_style,
    )


def _require_gm_system_capability(
    session: Session,
    gm_profile_id,
    game_system_id,
) -> None:
    capability = session.scalar(
        select(GMSystemExperience.id).where(
            GMSystemExperience.gm_profile_id == gm_profile_id,
            GMSystemExperience.game_system_id == game_system_id,
        )
    )
    if capability is None:
        raise MatchingSignalValidationError(
            "Add this game system to your GM profile before offering to run it."
        )


def create_gm_supply(
    session: Session,
    user: User,
    payload: GMSupplyCreate,
) -> GMSupplyResponse:
    """Persist one GM-owned supply signal atomically."""

    try:
        profile = require_gm_profile(session, user)
        system = resolve_active_system(session, payload.system_slug)
        _require_gm_system_capability(session, profile.id, system.id)
        signal = GMSupplySignal(
            gm_profile_id=profile.id,
            game_system_id=system.id,
            preferred_format=payload.preferred_format.value,
            preferred_cadence=payload.preferred_cadence or None,
            minimum_players=payload.minimum_players,
            maximum_players=payload.maximum_players,
            table_style=payload.table_style or None,
        )
        session.add(signal)
        session.commit()
        LOGGER.info("Created GM supply %s for user %s", signal.id, user.id)
        return _response(signal, system.slug)
    except (MatchingSignalValidationError, MatchingSignalConflictError):
        session.rollback()
        raise
    except IntegrityError as exc:
        session.rollback()
        LOGGER.warning("GM supply conflict for user %s", user.id, exc_info=True)
        raise MatchingSignalConflictError("GM supply conflicts with existing data.") from exc
    except SQLAlchemyError as exc:
        session.rollback()
        LOGGER.exception("GM supply database failure for user %s", user.id)
        raise MatchingSignalPersistenceError("GM supply could not be saved.") from exc
    except Exception as exc:
        session.rollback()
        LOGGER.exception("Unexpected GM supply failure for user %s", user.id)
        raise MatchingSignalPersistenceError("GM supply could not be saved.") from exc


def list_gm_supplies(session: Session, user: User) -> list[GMSupplyResponse]:
    """Return only supply signals owned by the authenticated GM."""

    try:
        profile = require_gm_profile(session, user)
        rows = session.execute(
            select(GMSupplySignal, GameSystem.slug)
            .join(GameSystem, GameSystem.id == GMSupplySignal.game_system_id)
            .where(GMSupplySignal.gm_profile_id == profile.id)
            .order_by(GMSupplySignal.created_at.desc(), GMSupplySignal.id)
        ).all()
        return [_response(signal, slug) for signal, slug in rows]
    except (MatchingSignalValidationError, MatchingSignalConflictError):
        raise
    except SQLAlchemyError as exc:
        LOGGER.exception("Failed to list GM supplies for user %s", user.id)
        raise MatchingSignalPersistenceError("GM supplies could not be loaded.") from exc
