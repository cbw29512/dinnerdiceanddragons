"""Resolve the verified provider identity into DDD account policy."""

from collections.abc import Mapping
from typing import Annotated, Any

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.api.dependencies.auth import get_verified_supabase_claims
from app.api.dependencies.rate_limit import enforce_authenticated_request_rate_limit
from app.db.session import get_db_session
from app.identity.user_linking import (
    IdentityClaimsError,
    IdentityLinkConflict,
    get_or_create_verified_user,
)
from app.models.user import AccountStatus, User


def get_current_user(
    claims: Annotated[Mapping[str, Any], Depends(get_verified_supabase_claims)],
    session: Annotated[Session, Depends(get_db_session)],
) -> User:
    """Return the caller's durable DDD account, creating/linking it when safe."""

    try:
        return get_or_create_verified_user(session, claims)
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


def require_active_user(
    request: Request,
    user: Annotated[User, Depends(get_current_user)],
) -> User:
    """Allow only active accounts and enforce their shared request allowance.

    Restricted, suspended, and banned users remain authenticated so they can
    inspect their own account state, but they cannot enter protected
    participation or mutation flows.
    """

    if user.status != AccountStatus.ACTIVE.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is not permitted to participate.",
        )
    enforce_authenticated_request_rate_limit(request, user)
    return user
