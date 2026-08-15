"""Authenticated caller identity route."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.api.dependencies.current_user import get_current_user
from app.models.user import User

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
    user: Annotated[User, Depends(get_current_user)],
) -> CurrentUser:
    """Return the caller's durable DDD identity, including account status."""

    return CurrentUser(
        ddd_user_id=user.id,
        auth_provider_user_id=user.auth_provider_user_id,
        email=user.email,
        display_name=user.display_name,
        status=user.status,
    )
