"""Verified Venue Manager API for booking lifecycle decisions."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.dependencies.roles import require_venue_manager
from app.db.session import get_db_session
from app.models.user import User
from app.schemas.event_lifecycle import VenueBookingAction, VenueBookingResponse
from app.services.event_access import EventForbiddenError, EventNotFoundError
from app.services.registration_common import RegistrationConflictError
from app.services.venue_booking_capacity import VenueCapacityConflictError
from app.services.venue_booking_service import (
    VenueBookingNotFoundError,
    VenueBookingPersistenceError,
    decide_venue_booking,
)

router = APIRouter(prefix="/venue-bookings", tags=["venue-bookings"])


@router.patch("/{booking_id}", response_model=VenueBookingResponse)
def patch_venue_booking(
    booking_id: UUID,
    payload: VenueBookingAction,
    user: Annotated[User, Depends(require_venue_manager)],
    session: Annotated[Session, Depends(get_db_session)],
) -> VenueBookingResponse:
    try:
        return decide_venue_booking(
            session,
            user,
            booking_id,
            payload.action,
            payload.message,
        )
    except (VenueBookingNotFoundError, EventNotFoundError) as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found.") from exc
    except EventForbiddenError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not permitted for this Venue booking.",
        ) from exc
    except (RegistrationConflictError, VenueCapacityConflictError) as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except VenueBookingPersistenceError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Venue booking action could not be completed.",
        ) from exc


__all__ = ["router"]
