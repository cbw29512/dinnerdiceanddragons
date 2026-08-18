"""Authenticated Player and owning-GM Event registration mutations."""

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
    RegistrationCancellationRequest,
    RegistrationDecisionRequest,
    RegistrationMutationResponse,
    RegistrationRequest,
)
from app.services.event_registration_service import (
    cancel_my_registration,
    decide_event_registration,
    request_event_registration,
)
from app.services.table_formation_errors import TableFormationError

LOGGER = logging.getLogger(__name__)
router = APIRouter(prefix="/events", tags=["event-registrations"])


@router.post(
    "/{event_id}/registrations",
    response_model=RegistrationMutationResponse,
)
def post_registration(
    event_id: UUID,
    payload: RegistrationRequest,
    user: Annotated[User, Depends(require_active_user)],
    session: Annotated[Session, Depends(get_db_session)],
) -> RegistrationMutationResponse:
    """Allow one eligible authenticated Player to request their own seat."""

    try:
        result = request_event_registration(
            session,
            event_id=event_id,
            caller_user_id=user.id,
            expectations_acknowledged=payload.expectations_acknowledged,
        )
        return _response(result)
    except TableFormationError as exc:
        raise_table_formation_http(exc)
    except Exception as exc:
        LOGGER.exception("Player Event registration API failed")
        raise HTTPException(status_code=500, detail="Registration failed.") from exc


@router.patch(
    "/{event_id}/registrations/me",
    response_model=RegistrationMutationResponse,
)
def patch_my_registration(
    event_id: UUID,
    _: RegistrationCancellationRequest,
    user: Annotated[User, Depends(require_active_user)],
    session: Annotated[Session, Depends(get_db_session)],
) -> RegistrationMutationResponse:
    """Allow the authenticated Player to cancel their own registration."""

    try:
        return _response(
            cancel_my_registration(
                session,
                event_id=event_id,
                caller_user_id=user.id,
            )
        )
    except TableFormationError as exc:
        raise_table_formation_http(exc)
    except Exception as exc:
        LOGGER.exception("Player registration cancellation API failed")
        raise HTTPException(status_code=500, detail="Registration cancellation failed.") from exc


@router.patch(
    "/{event_id}/registrations/{registration_id}",
    response_model=RegistrationMutationResponse,
)
def patch_registration(
    event_id: UUID,
    registration_id: UUID,
    payload: RegistrationDecisionRequest,
    user: Annotated[User, Depends(require_active_user)],
    session: Annotated[Session, Depends(get_db_session)],
) -> RegistrationMutationResponse:
    """Allow the owning GM to make one seat lifecycle decision."""

    try:
        return _response(
            decide_event_registration(
                session,
                event_id=event_id,
                registration_id=registration_id,
                caller_user_id=user.id,
                target_status=payload.status,
            )
        )
    except TableFormationError as exc:
        raise_table_formation_http(exc)
    except Exception as exc:
        LOGGER.exception("GM registration decision API failed")
        raise HTTPException(status_code=500, detail="Registration update failed.") from exc


def _response(result) -> RegistrationMutationResponse:
    return RegistrationMutationResponse(
        registration_id=result.registration_id,
        status=result.status,
        event_status=result.event_status,
        expected_guests=result.expected_guests,
    )


__all__ = ["router"]
