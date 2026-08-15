"""Authenticated caller identity route."""

from collections.abc import Mapping
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.dependencies.auth import get_verified_supabase_claims
from app.db.session import get_db_session
from app.identity.user_linking import (
    IdentityClaimsError,
    IdentityLinkConflict,
    get_or_create_verified_user,
)

router = APIRouter(tags=["identity"])


class CurrentUser(BaseModel):
    """Safe authenticated identity plus the durable DDD account identifier."""

    ddd_user_id: UUID
    auth_provider: str = "supabase"
    auth_provider_user_id: str
    email: str
    display_name: str | None = None
    status: str


@router.get(
    "/me",
    response_model=CurrentUser,
    summary="Get the authenticated caller",
)
def get_me(
    claims: Annotated[Mapping[str, Any], Depends(get_verified_supabase_claims)],
    session: Annotated[Session, Depends(get_db_session)],
) -> CurrentUser:
    """Return the caller's durable DDD identity after safe provider linking."""

    try:
        user = get_or_create_verified_user(session, claims)
    except IdentityClaimsError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authenticated identity is incomplete.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    except IdentityLinkConflict as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This sign-in could not be safely linked to a DDD account.",
        ) from exc

    return CurrentUser(
        ddd_user_id=user.id,
        auth_provider_user_id=user.auth_provider_user_id,
        email=user.email,
        display_name=user.display_name,
        status=user.status,
    )
