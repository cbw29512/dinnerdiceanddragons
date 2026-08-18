"""Authenticated production API for running and reading Table Match opportunities."""

import logging
from collections.abc import Callable
from typing import Annotated, NoReturn
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.dependencies.current_user import require_active_user
from app.api.dependencies.roles import require_admin
from app.api.rate_limit import enforce_user_rate_limit
from app.db.session import get_db_session
from app.models.user import User
from app.schemas.table_match_opportunities import (
    TableMatchOpportunityDetailResponse,
    TableMatchOpportunityResponse,
    TableMatchRunRequest,
    TableMatchRunResponse,
)
from app.services.api_rate_limit_policy import RateLimitScope
from app.services.table_match_engine_policy import TableMatchHorizonError
from app.services.table_match_opportunity_reads import (
    TableMatchOpportunityNotFoundError,
    TableMatchOpportunityReadError,
    get_opportunity,
    list_opportunities,
)
from app.services.table_match_runner import TableMatchRunResult, run_table_match

LOGGER = logging.getLogger(__name__)
router = APIRouter(prefix="/matching", tags=["matching"])
MatchRunner = Callable[..., TableMatchRunResult]


def get_match_runner() -> MatchRunner:
    """Return the production runner; tests may override this dependency."""

    return run_table_match


def _raise_read_error(exc: Exception) -> NoReturn:
    if isinstance(exc, TableMatchOpportunityNotFoundError):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Opportunity not found.",
        ) from exc
    if isinstance(exc, TableMatchOpportunityReadError):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Matching opportunities could not be loaded.",
        ) from exc
    raise exc


@router.post("/run", response_model=TableMatchRunResponse)
def post_matching_run(
    payload: TableMatchRunRequest,
    user: Annotated[User, Depends(require_admin)],
    session: Annotated[Session, Depends(get_db_session)],
    runner: Annotated[MatchRunner, Depends(get_match_runner)],
) -> TableMatchRunResponse:
    """Run bounded global matching through an admin/internal production boundary."""

    try:
        enforce_user_rate_limit(session, user, RateLimitScope.MATCHING_RUN)
        result = runner(
            window_start=payload.window_start,
            window_end=payload.window_end,
        )
    except TableMatchHorizonError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(exc),
        ) from exc
    except HTTPException:
        raise
    except Exception as exc:
        LOGGER.exception("Authorized Table Match run failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Matching run could not be completed.",
        ) from exc

    return TableMatchRunResponse(
        computed_opportunities=result.computed_opportunities,
        persisted_count=len(result.persisted),
        created_count=sum(item.created for item in result.persisted),
        refreshed_count=sum(item.refreshed for item in result.persisted),
        expired_count=result.expired_count,
    )


@router.get("/opportunities", response_model=list[TableMatchOpportunityResponse])
def get_matching_opportunities(
    user: Annotated[User, Depends(require_active_user)],
    session: Annotated[Session, Depends(get_db_session)],
) -> list[TableMatchOpportunityResponse]:
    """List only opportunities related to the authenticated caller."""

    try:
        return list_opportunities(session, user)
    except HTTPException:
        raise
    except Exception as exc:
        _raise_read_error(exc)


@router.get(
    "/opportunities/{table_match_id}",
    response_model=TableMatchOpportunityDetailResponse,
)
def get_matching_opportunity(
    table_match_id: UUID,
    user: Annotated[User, Depends(require_active_user)],
    session: Annotated[Session, Depends(get_db_session)],
) -> TableMatchOpportunityDetailResponse:
    """Return explainable detail without leaking another caller's private facts."""

    try:
        return get_opportunity(session, user, table_match_id)
    except HTTPException:
        raise
    except Exception as exc:
        _raise_read_error(exc)


__all__ = ["get_match_runner", "router"]
