"""Authenticated caller identity route."""

from collections.abc import Mapping
from typing import Annotated, Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.api.dependencies.auth import get_verified_supabase_claims

router = APIRouter(tags=["identity"])


class AuthenticatedPrincipal(BaseModel):
    """Safe subset of the verified provider identity exposed by `/me`."""

    auth_provider: str = "supabase"
    auth_provider_user_id: str
    email: str | None = None


@router.get(
    "/me",
    response_model=AuthenticatedPrincipal,
    summary="Get the authenticated caller",
)
def get_me(
    claims: Annotated[Mapping[str, Any], Depends(get_verified_supabase_claims)],
) -> AuthenticatedPrincipal:
    """Return the verified Supabase principal without exposing the raw JWT."""

    return AuthenticatedPrincipal(
        auth_provider_user_id=str(claims["sub"]),
        email=str(claims["email"]) if claims.get("email") else None,
    )
