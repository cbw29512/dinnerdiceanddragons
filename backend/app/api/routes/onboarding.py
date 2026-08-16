"""Authenticated production onboarding routes."""

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.dependencies.current_user import require_active_user
from app.db.session import get_db_session
from app.models.user import User
from app.schemas.gm_onboarding import GMOnboardingRequest, GMOnboardingResponse
from app.schemas.player_onboarding import PlayerOnboardingRequest, PlayerOnboardingResponse
from app.services.gm_onboarding import save_gm_onboarding
from app.services.onboarding_common import (
    OnboardingConflictError,
    OnboardingPersistenceError,
    OnboardingValidationError,
)
from app.services.player_onboarding import save_player_onboarding

LOGGER = logging.getLogger(__name__)
router = APIRouter(prefix="/onboarding", tags=["onboarding"])


@router.put("/player", response_model=PlayerOnboardingResponse)
def put_player_onboarding(
    payload: PlayerOnboardingRequest,
    current_user: Annotated[User, Depends(require_active_user)],
    session: Annotated[Session, Depends(get_db_session)],
) -> PlayerOnboardingResponse:
    """Persist the authenticated caller's complete Step 2 Player state."""

    try:
        result = save_player_onboarding(session, current_user, payload)
        return PlayerOnboardingResponse(
            player_profile_id=result.player_profile_id,
            display_name=result.display_name,
            role="player",
            system_slugs=result.system_slugs,
            availability_count=result.availability_count,
        )
    except OnboardingValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(exc),
        ) from exc
    except OnboardingConflictError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc
    except OnboardingPersistenceError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Player onboarding could not be saved.",
        ) from exc
    except HTTPException:
        raise
    except Exception as exc:
        LOGGER.exception("Unhandled Player onboarding route failure")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Player onboarding could not be saved.",
        ) from exc


@router.put("/gm", response_model=GMOnboardingResponse)
def put_gm_onboarding(
    payload: GMOnboardingRequest,
    current_user: Annotated[User, Depends(require_active_user)],
    session: Annotated[Session, Depends(get_db_session)],
) -> GMOnboardingResponse:
    """Persist the authenticated caller's complete Step 2 GM state."""

    try:
        result = save_gm_onboarding(session, current_user, payload)
        return GMOnboardingResponse(
            gm_profile_id=result.gm_profile_id,
            display_name=result.display_name,
            role="gm",
            system_slugs=result.system_slugs,
            availability_count=result.availability_count,
        )
    except OnboardingValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(exc),
        ) from exc
    except OnboardingConflictError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc
    except OnboardingPersistenceError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="GM onboarding could not be saved.",
        ) from exc
    except HTTPException:
        raise
    except Exception as exc:
        LOGGER.exception("Unhandled GM onboarding route failure")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="GM onboarding could not be saved.",
        ) from exc
