"""Authenticated APIs for the three production Table Match input types."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.dependencies.roles import require_dm, require_player, require_venue_manager
from app.api.matching_signal_errors import raise_matching_signal_http
from app.api.rate_limit import enforce_user_rate_limit
from app.db.session import get_db_session
from app.models.user import User
from app.schemas.matching_signals import (
    GMSupplyCreate,
    GMSupplyResponse,
    PlayerDemandCreate,
    PlayerDemandResponse,
    VenueTableWindowCreate,
    VenueTableWindowResponse,
)
from app.services.api_rate_limit_policy import RateLimitScope
from app.services.gm_supply import create_gm_supply, list_gm_supplies
from app.services.player_demand import create_player_demand, list_player_demands
from app.services.venue_table_windows import (
    create_venue_table_window,
    list_venue_table_windows,
)

router = APIRouter(prefix="/matching", tags=["matching"])


@router.post(
    "/player-demands",
    response_model=PlayerDemandResponse,
    status_code=status.HTTP_201_CREATED,
)
def post_player_demand(
    payload: PlayerDemandCreate,
    user: Annotated[User, Depends(require_player)],
    session: Annotated[Session, Depends(get_db_session)],
) -> PlayerDemandResponse:
    """Create one demand signal owned by the authenticated Player."""

    try:
        enforce_user_rate_limit(session, user, RateLimitScope.MATCHING_INPUT)
        return create_player_demand(session, user, payload)
    except HTTPException:
        raise
    except Exception as exc:
        raise_matching_signal_http(exc)


@router.get("/player-demands", response_model=list[PlayerDemandResponse])
def get_player_demands(
    user: Annotated[User, Depends(require_player)],
    session: Annotated[Session, Depends(get_db_session)],
) -> list[PlayerDemandResponse]:
    """List only demand signals owned by the authenticated Player."""

    try:
        return list_player_demands(session, user)
    except HTTPException:
        raise
    except Exception as exc:
        raise_matching_signal_http(exc)


@router.post(
    "/gm-supplies",
    response_model=GMSupplyResponse,
    status_code=status.HTTP_201_CREATED,
)
def post_gm_supply(
    payload: GMSupplyCreate,
    user: Annotated[User, Depends(require_dm)],
    session: Annotated[Session, Depends(get_db_session)],
) -> GMSupplyResponse:
    """Create one supply signal owned by the authenticated GM."""

    try:
        enforce_user_rate_limit(session, user, RateLimitScope.MATCHING_INPUT)
        return create_gm_supply(session, user, payload)
    except HTTPException:
        raise
    except Exception as exc:
        raise_matching_signal_http(exc)


@router.get("/gm-supplies", response_model=list[GMSupplyResponse])
def get_gm_supplies(
    user: Annotated[User, Depends(require_dm)],
    session: Annotated[Session, Depends(get_db_session)],
) -> list[GMSupplyResponse]:
    """List only supply signals owned by the authenticated GM."""

    try:
        return list_gm_supplies(session, user)
    except HTTPException:
        raise
    except Exception as exc:
        raise_matching_signal_http(exc)


@router.post(
    "/venues/{venue_id}/table-windows",
    response_model=VenueTableWindowResponse,
    status_code=status.HTTP_201_CREATED,
)
def post_venue_table_window(
    venue_id: UUID,
    payload: VenueTableWindowCreate,
    user: Annotated[User, Depends(require_venue_manager)],
    session: Annotated[Session, Depends(get_db_session)],
) -> VenueTableWindowResponse:
    """Create one table window for a verified Venue Manager relationship."""

    try:
        enforce_user_rate_limit(session, user, RateLimitScope.MATCHING_INPUT)
        return create_venue_table_window(session, user, venue_id, payload)
    except HTTPException:
        raise
    except Exception as exc:
        raise_matching_signal_http(exc)


@router.get(
    "/venues/{venue_id}/table-windows",
    response_model=list[VenueTableWindowResponse],
)
def get_venue_table_windows(
    venue_id: UUID,
    user: Annotated[User, Depends(require_venue_manager)],
    session: Annotated[Session, Depends(get_db_session)],
) -> list[VenueTableWindowResponse]:
    """List Venue table windows only for a verified manager relationship."""

    try:
        return list_venue_table_windows(session, user, venue_id)
    except HTTPException:
        raise
    except Exception as exc:
        raise_matching_signal_http(exc)
