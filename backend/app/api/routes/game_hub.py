"""Authenticated production API for the live three-sided Game Hub."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.dependencies.current_user import require_active_user
from app.api.rate_limit import enforce_user_rate_limit
from app.db.session import get_db_session
from app.models.user import User
from app.schemas.game_hub import (
    GameHubResponse,
    HubIndexItem,
    HubMessagePageResponse,
    HubMessageResponse,
    MessageCreateRequest,
)
from app.services.api_rate_limit_policy import RateLimitScope
from app.services.event_access import EventNotFoundError
from app.services.event_reads import EventReadError
from app.services.game_hub_index import list_game_hubs
from app.services.game_hub_message_policy import (
    HubMessageConflictError,
    HubMessageForbiddenError,
)
from app.services.game_hub_messages import (
    HubMessagePersistenceError,
    create_hub_message,
    list_hub_messages,
)
from app.services.game_hub_reads import get_game_hub
from app.services.message_cursor import MessageCursorError

router = APIRouter(prefix="/events", tags=["game-hub"])
index_router = APIRouter(prefix="/game-hubs", tags=["game-hub"])


@index_router.get("", response_model=list[HubIndexItem])
def get_hub_index(
    user: Annotated[User, Depends(require_active_user)],
    session: Annotated[Session, Depends(get_db_session)],
) -> list[HubIndexItem]:
    return list_game_hubs(session, user)


@router.get("/{event_id}/hub", response_model=GameHubResponse)
def get_hub(
    event_id: UUID,
    user: Annotated[User, Depends(require_active_user)],
    session: Annotated[Session, Depends(get_db_session)],
) -> GameHubResponse:
    try:
        return get_game_hub(session, user, event_id)
    except EventNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Game Hub not found."
        ) from exc
    except EventReadError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Game Hub could not be loaded.",
        ) from exc


@router.get("/{event_id}/messages", response_model=HubMessagePageResponse)
def get_messages(
    event_id: UUID,
    user: Annotated[User, Depends(require_active_user)],
    session: Annotated[Session, Depends(get_db_session)],
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    cursor: Annotated[str | None, Query(max_length=256)] = None,
) -> HubMessagePageResponse:
    try:
        return list_hub_messages(session, user, event_id, limit=limit, cursor=cursor)
    except EventNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Game Hub not found."
        ) from exc
    except MessageCursorError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Invalid message cursor.",
        ) from exc
    except HubMessagePersistenceError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Messages could not be loaded.",
        ) from exc


@router.post("/{event_id}/messages", response_model=HubMessageResponse)
def post_message(
    event_id: UUID,
    payload: MessageCreateRequest,
    user: Annotated[User, Depends(require_active_user)],
    session: Annotated[Session, Depends(get_db_session)],
) -> HubMessageResponse:
    try:
        enforce_user_rate_limit(session, user, RateLimitScope.HUB_MESSAGE)
        return create_hub_message(session, user, event_id, payload)
    except HTTPException:
        raise
    except EventNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Game Hub not found."
        ) from exc
    except HubMessageForbiddenError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This Hub role cannot post to that channel.",
        ) from exc
    except HubMessageConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except HubMessagePersistenceError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Message could not be persisted.",
        ) from exc


__all__ = ["index_router", "router"]
