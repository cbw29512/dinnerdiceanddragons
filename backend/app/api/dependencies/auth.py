"""FastAPI dependencies for verified Supabase bearer authentication."""

from collections.abc import Mapping
from functools import lru_cache
from typing import Annotated, Any

from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.auth.supabase_jwt import (
    AuthenticationConfigurationError,
    SupabaseJWTVerifier,
    TokenVerificationError,
)

bearer_scheme = HTTPBearer(auto_error=False)


@lru_cache
def get_supabase_jwt_verifier() -> SupabaseJWTVerifier:
    """Return the process-level verifier without constructing it at import time."""

    return SupabaseJWTVerifier()


def get_verified_supabase_claims(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None,
        Security(bearer_scheme),
    ],
    verifier: Annotated[SupabaseJWTVerifier, Depends(get_supabase_jwt_verifier)],
) -> Mapping[str, Any]:
    """Require and verify a Supabase user bearer token."""

    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        return verifier.verify(credentials.credentials)
    except TokenVerificationError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    except AuthenticationConfigurationError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service is not configured.",
        ) from exc
