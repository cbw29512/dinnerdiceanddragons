"""Authenticated verified-Venue booking lifecycle API."""

import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.dependencies.current_user import require_active_user
from app.api.table_formation_http import raise_table_formation_http
from app.db.session import get_db_session
from app.models.user import User
from app.schemas.table_formation import (
    VenueBookingTransitionRequest,
    VenueBookingTransitionResponse,
)
from app.services.table_formation_errors import TableFormationError
from app.services.venue_booking_transitions import transition_venue_booking

LOGGER = logging.getLogger(__name__)
router = APIRouter(prefix="/venue-bookings", tags=["venue-bookings"])


@router.patch("/{booking_id}", response_model=VenueBookingTransitionResponse)
def patch_venue_booking(
    booking_id: UUID,
    payload: VenueBookingTransitionRequest,
    user: Annotated[User, Depends(require_active_user)],
    session: Annotated[Session, Depends(get_db_session)],
) -> VenueBookingTransitionResponse:
    """Apply one verified Venue Manager transition to the exact Venue booking."""

    try:
        result = transition_venue_booking(
            session,
            booking_id=booking_id,
            caller_user_id=user.id,
            target_status=payload.status,
            venue_message=payload.venue_message,
        )
        return VenueBookingTransitionResponse(
            booking_id=result.booking_id,
            event_id=result.event_id,
            status=result.status,
            event_status=result.event_status,
            expected_guests=result.expected_guests,
        )
    except TableFormationError as exc:
        raise_table_formation_http(exc)
    except Exception as exc:
        LOGGER.exception("Venue booking transition API failed")
        raise HTTPException(status_code=500, detail="Venue booking update failed.") from exc


__all__ = ["router"]
