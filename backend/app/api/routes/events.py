"""Authenticated Event reads and Player/GM registration lifecycle routes."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.dependencies.current_user import require_active_user
from app.api.dependencies.roles import require_dm, require_player
from app.api.rate_limit import enforce_user_rate_limit
from app.db.session import get_db_session
from app.models.user import User
from app.schemas.event_lifecycle import (
    EventResponse,
    GMRegistrationAction,
    PlayerRegistrationAction,
    RegistrationRequest,
    RegistrationResponse,
)
from app.services.api_rate_limit_policy import RateLimitScope
from app.services.event_access import EventForbiddenError, EventNotFoundError
from app.services.event_reads import EventReadError, get_event_for_user
from app.services.gm_registration_service import decide_registration
from app.services.player_registration_service import cancel_registration, request_registration
from app.services.registration_common import (
    RegistrationConflictError,
    RegistrationNotFoundError,
    RegistrationPersistenceError,
)

router = APIRouter(prefix="/events", tags=["events"])


@router.get("/{event_id}", response_model=EventResponse)
def get_event(
    event_id: UUID,
    user: Annotated[User, Depends(require_active_user)],
    session: Annotated[Session, Depends(get_db_session)],
) -> EventResponse:
    try:
        return get_event_for_user(session, user, event_id)
    except EventNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found.") from exc
    except EventReadError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Event could not be loaded.",
        ) from exc


@router.post("/{event_id}/registrations", response_model=RegistrationResponse)
def post_registration(
    event_id: UUID,
    _: RegistrationRequest,
    user: Annotated[User, Depends(require_player)],
    session: Annotated[Session, Depends(get_db_session)],
) -> RegistrationResponse:
    try:
        enforce_user_rate_limit(session, user, RateLimitScope.EVENT_REGISTRATION)
        return request_registration(session, user, event_id)
    except Exception as exc:
        _raise_registration_http(exc)


@router.patch("/{event_id}/registrations/me", response_model=RegistrationResponse)
def patch_my_registration(
    event_id: UUID,
    payload: PlayerRegistrationAction,
    user: Annotated[User, Depends(require_player)],
    session: Annotated[Session, Depends(get_db_session)],
) -> RegistrationResponse:
    del payload
    try:
        enforce_user_rate_limit(session, user, RateLimitScope.EVENT_REGISTRATION)
        return cancel_registration(session, user, event_id)
    except Exception as exc:
        _raise_registration_http(exc)


@router.patch("/{event_id}/registrations/{registration_id}", response_model=RegistrationResponse)
def patch_registration(
    event_id: UUID,
    registration_id: UUID,
    payload: GMRegistrationAction,
    user: Annotated[User, Depends(require_dm)],
    session: Annotated[Session, Depends(get_db_session)],
) -> RegistrationResponse:
    try:
        enforce_user_rate_limit(session, user, RateLimitScope.EVENT_REGISTRATION)
        return decide_registration(session, user, event_id, registration_id, payload.action)
    except Exception as exc:
        _raise_registration_http(exc)


def _raise_registration_http(exc: Exception) -> None:
    if isinstance(exc, HTTPException):
        raise exc
    if isinstance(exc, (EventNotFoundError, RegistrationNotFoundError)):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found.") from exc
    if isinstance(exc, EventForbiddenError):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not permitted for this Event.",
        ) from exc
    if isinstance(exc, RegistrationConflictError):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    if isinstance(exc, RegistrationPersistenceError):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Registration action could not be completed.",
        ) from exc
    raise exc


__all__ = ["router"]
