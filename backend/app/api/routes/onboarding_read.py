"""Authenticated owner-only onboarding readback routes."""

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.dependencies.current_user import require_active_user
from app.db.session import get_db_session
from app.models.user import User
from app.schemas.onboarding_state import GMOnboardingState, PlayerOnboardingState
from app.services.gm_onboarding_read import (
    GMOnboardingStateNotFoundError,
    load_gm_onboarding,
)
from app.services.player_onboarding_read import (
    PlayerOnboardingStateNotFoundError,
    load_player_onboarding,
)

LOGGER = logging.getLogger(__name__)
router = APIRouter(prefix="/onboarding", tags=["onboarding"])


@router.get("/player", response_model=PlayerOnboardingState)
def get_player_onboarding(
    current_user: Annotated[User, Depends(require_active_user)],
    session: Annotated[Session, Depends(get_db_session)],
) -> PlayerOnboardingState:
    """Return the authenticated caller's persisted Player onboarding state."""

    try:
        return load_player_onboarding(session, current_user)
    except PlayerOnboardingStateNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except Exception as exc:
        LOGGER.exception("Unhandled Player onboarding read failure")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Player onboarding could not be loaded.",
        ) from exc


@router.get("/gm", response_model=GMOnboardingState)
def get_gm_onboarding(
    current_user: Annotated[User, Depends(require_active_user)],
    session: Annotated[Session, Depends(get_db_session)],
) -> GMOnboardingState:
    """Return the authenticated caller's persisted GM onboarding state."""

    try:
        return load_gm_onboarding(session, current_user)
    except GMOnboardingStateNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except Exception as exc:
        LOGGER.exception("Unhandled GM onboarding read failure")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="GM onboarding could not be loaded.",
        ) from exc
