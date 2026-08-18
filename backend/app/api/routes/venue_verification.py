"""Admin-only API for approving initial Venue claims."""

import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.api.dependencies.roles import require_admin
from app.api.rate_limit import enforce_user_rate_limit
from app.db.session import get_db_session
from app.models.user import User
from app.services.api_rate_limit_policy import RateLimitScope
from app.services.geocoding import (
    GeocodingConfigurationError,
    GeocodingNoMatchError,
    GeocodingPrecisionError,
    GeocodingProviderError,
    VenueGeocoder,
)
from app.services.geocodio_geocoder import GeocodioVenueGeocoder
from app.services.venue_verification import (
    VenueVerificationConflictError,
    VenueVerificationNotFoundError,
    VenueVerificationPersistenceError,
    VenueVerificationValidationError,
    load_initial_venue_claim_for_verification,
    verify_initial_venue_claim,
)

LOGGER = logging.getLogger(__name__)
router = APIRouter(prefix="/admin", tags=["admin"])


def get_venue_geocoder() -> VenueGeocoder:
    """Return the configured server-side Venue geocoder."""

    return GeocodioVenueGeocoder()


@router.post(
    "/venues/{venue_id}/manager-claims/{venue_manager_id}/verify",
    status_code=status.HTTP_204_NO_CONTENT,
)
def post_venue_verification(
    venue_id: UUID,
    venue_manager_id: UUID,
    admin_user: Annotated[User, Depends(require_admin)],
    session: Annotated[Session, Depends(get_db_session)],
    geocoder: Annotated[VenueGeocoder, Depends(get_venue_geocoder)],
) -> Response:
    """Approve one pending Venue claim using its persisted public address."""

    try:
        enforce_user_rate_limit(session, admin_user, RateLimitScope.PROVIDER_GEOCODING)
        candidate = load_initial_venue_claim_for_verification(
            session,
            venue_id=venue_id,
            venue_manager_id=venue_manager_id,
        )

        location = geocoder.geocode(candidate.address)

        verify_initial_venue_claim(
            session,
            admin_user,
            venue_id=candidate.venue_id,
            venue_manager_id=candidate.venue_manager_id,
            expected_address=candidate.address,
            latitude=location.latitude,
            longitude=location.longitude,
        )

    except VenueVerificationValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(exc),
        ) from exc
    except VenueVerificationNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except VenueVerificationConflictError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc
    except (GeocodingNoMatchError, GeocodingPrecisionError) as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(exc),
        ) from exc
    except (GeocodingConfigurationError, GeocodingProviderError) as exc:
        LOGGER.warning("Server-side Venue geocoding unavailable during verification")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Venue geocoding is temporarily unavailable.",
        ) from exc
    except VenueVerificationPersistenceError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Venue verification could not be processed.",
        ) from exc
    except HTTPException:
        raise
    except Exception as exc:
        LOGGER.exception("Unhandled Venue verification route failure")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Venue verification could not be processed.",
        ) from exc

    return Response(status_code=status.HTTP_204_NO_CONTENT)
