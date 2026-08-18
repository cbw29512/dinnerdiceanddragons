"""Authenticated API for TableMatch conversion and role-safe formed Event reads."""

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
    EventFormationDetailResponse,
    EventFormationResponse,
    FormTableMatchRequest,
    FormTableMatchResponse,
    GMRegistrationQueueItemResponse,
)
from app.services.event_formation_reads import (
    get_formed_event,
    list_event_registration_queue,
    list_formed_events,
)
from app.services.table_formation_conversion import form_table_match
from app.services.table_formation_errors import TableFormationError

LOGGER = logging.getLogger(__name__)
router = APIRouter(tags=["events"])


@router.post(
    "/matching/opportunities/{table_match_id}/form",
    response_model=FormTableMatchResponse,
)
def post_form_table_match(
    table_match_id: UUID,
    payload: FormTableMatchRequest,
    user: Annotated[User, Depends(require_active_user)],
    session: Annotated[Session, Depends(get_db_session)],
) -> FormTableMatchResponse:
    """Allow the owning GM to convert one current match into durable Event state."""

    try:
        result = form_table_match(
            session,
            table_match_id=table_match_id,
            caller_user_id=user.id,
            title=payload.title,
            description=payload.description,
        )
        return FormTableMatchResponse(
            game_series_id=result.game_series_id,
            event_id=result.event_id,
            venue_booking_request_id=result.venue_booking_request_id,
            created=result.created,
        )
    except TableFormationError as exc:
        raise_table_formation_http(exc)
    except HTTPException:
        raise
    except Exception as exc:
        LOGGER.exception("TableMatch formation API failed")
        raise HTTPException(status_code=500, detail="Table formation failed.") from exc


@router.get("/events", response_model=list[EventFormationResponse])
def get_events(
    user: Annotated[User, Depends(require_active_user)],
    session: Annotated[Session, Depends(get_db_session)],
) -> list[EventFormationResponse]:
    """List formed Events related to the authenticated caller."""

    try:
        return list_formed_events(session, user)
    except TableFormationError as exc:
        raise_table_formation_http(exc)
    except Exception as exc:
        LOGGER.exception("Formed Event list API failed")
        raise HTTPException(status_code=500, detail="Events could not be loaded.") from exc


@router.get("/events/{event_id}", response_model=EventFormationDetailResponse)
def get_event(
    event_id: UUID,
    user: Annotated[User, Depends(require_active_user)],
    session: Annotated[Session, Depends(get_db_session)],
) -> EventFormationDetailResponse:
    """Return one formed Event without leaking another user's private state."""

    try:
        return get_formed_event(session, user, event_id)
    except TableFormationError as exc:
        raise_table_formation_http(exc)
    except Exception as exc:
        LOGGER.exception("Formed Event detail API failed")
        raise HTTPException(status_code=500, detail="Event could not be loaded.") from exc


@router.get(
    "/events/{event_id}/registrations",
    response_model=list[GMRegistrationQueueItemResponse],
)
def get_event_registrations(
    event_id: UUID,
    user: Annotated[User, Depends(require_active_user)],
    session: Annotated[Session, Depends(get_db_session)],
) -> list[GMRegistrationQueueItemResponse]:
    """Return the owning GM's seat-decision queue without private Player contact data."""

    try:
        return list_event_registration_queue(session, user, event_id)
    except TableFormationError as exc:
        raise_table_formation_http(exc)
    except Exception as exc:
        LOGGER.exception("Event registration queue API failed")
        raise HTTPException(status_code=500, detail="Registrations could not be loaded.") from exc


__all__ = ["router"]
