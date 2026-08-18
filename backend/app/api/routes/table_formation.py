"""GM-owned API for converting a Table Match into durable formation state."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.dependencies.roles import require_dm
from app.api.rate_limit import enforce_user_rate_limit
from app.db.session import get_db_session
from app.models.user import User
from app.schemas.table_formation import FormTableMatchRequest, FormTableMatchResponse
from app.services.api_rate_limit_policy import RateLimitScope
from app.services.table_formation_conversion import form_table_match
from app.services.table_formation_errors import (
    FormationConflictError,
    FormationForbiddenError,
    FormationNotFoundError,
    FormationPersistenceError,
)
from app.services.venue_booking_capacity import VenueCapacityConflictError

router = APIRouter(prefix="/matching/opportunities", tags=["table-formation"])


@router.post("/{table_match_id}/form", response_model=FormTableMatchResponse)
def post_form_table_match(
    table_match_id: UUID,
    payload: FormTableMatchRequest,
    user: Annotated[User, Depends(require_dm)],
    session: Annotated[Session, Depends(get_db_session)],
) -> FormTableMatchResponse:
    try:
        enforce_user_rate_limit(session, user, RateLimitScope.TABLE_FORMATION)
        return form_table_match(session, user, table_match_id, payload)
    except HTTPException:
        raise
    except FormationNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Opportunity not found.",
        ) from exc
    except FormationForbiddenError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not permitted for this opportunity.",
        ) from exc
    except (FormationConflictError, VenueCapacityConflictError) as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc
    except FormationPersistenceError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Table formation could not be completed.",
        ) from exc


__all__ = ["router"]
