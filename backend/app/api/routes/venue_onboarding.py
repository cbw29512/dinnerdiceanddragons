"""Authenticated production Venue onboarding route."""

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.dependencies.current_user import require_active_user
from app.api.rate_limit import enforce_user_rate_limit
from app.db.session import get_db_session
from app.models.user import User
from app.schemas.venue_onboarding import VenueOnboardingRequest, VenueOnboardingResponse
from app.services.api_rate_limit_policy import RateLimitScope
from app.services.onboarding_common import OnboardingConflictError, OnboardingPersistenceError
from app.services.venue_onboarding import save_venue_onboarding

LOGGER = logging.getLogger(__name__)
router = APIRouter(prefix="/onboarding", tags=["onboarding"])


@router.post(
    "/venue",
    response_model=VenueOnboardingResponse,
    status_code=status.HTTP_201_CREATED,
)
def post_venue_onboarding(
    payload: VenueOnboardingRequest,
    current_user: Annotated[User, Depends(require_active_user)],
    session: Annotated[Session, Depends(get_db_session)],
) -> VenueOnboardingResponse:
    """Create a public Venue and pending manager claim for the caller."""

    try:
        enforce_user_rate_limit(session, current_user, RateLimitScope.ONBOARDING_MUTATION)
        result = save_venue_onboarding(session, current_user, payload)
        return VenueOnboardingResponse(
            venue_id=result.venue_id,
            venue_manager_id=result.venue_manager_id,
            name=result.name,
            slug=result.slug,
            role=result.role,
            venue_verified=False,
            manager_verified=False,
        )
    except OnboardingConflictError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc
    except OnboardingPersistenceError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Venue onboarding could not be saved.",
        ) from exc
    except HTTPException:
        raise
    except Exception as exc:
        LOGGER.exception("Unhandled Venue onboarding route failure")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Venue onboarding could not be saved.",
        ) from exc
