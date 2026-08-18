"""Owning-GM API for shared Event table expectations."""

import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.dependencies.current_user import require_active_user
from app.api.table_formation_http import raise_table_formation_http
from app.db.session import get_db_session
from app.models.user import User
from app.schemas.table_expectation_updates import TableExpectationsUpdateRequest
from app.schemas.table_formation import EventExpectationsResponse
from app.services.event_expectations_read import render_event_expectations
from app.services.event_expectations_update import update_event_expectations
from app.services.table_formation_errors import TableFormationError

LOGGER = logging.getLogger(__name__)
router = APIRouter(prefix="/events", tags=["event-expectations"])


@router.patch(
    "/{event_id}/expectations",
    response_model=EventExpectationsResponse,
)
def patch_event_expectations(
    event_id: UUID,
    payload: TableExpectationsUpdateRequest,
    user: Annotated[User, Depends(require_active_user)],
    session: Annotated[Session, Depends(get_db_session)],
) -> EventExpectationsResponse:
    """Allow the owning GM to edit policies only before registration begins."""

    try:
        updated = update_event_expectations(
            session,
            event_id=event_id,
            caller_user_id=user.id,
            values=payload.model_dump(exclude_unset=True),
        )
        return render_event_expectations(updated)
    except TableFormationError as exc:
        raise_table_formation_http(exc)
    except Exception as exc:
        LOGGER.exception("Event expectations API failed")
        raise HTTPException(status_code=500, detail="Event expectations update failed.") from exc


__all__ = ["router"]
