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
def get_supabase_jwt_verifier() -> SupabaseJWTVerifier | None:
    """Return the process-level verifier, or ``None`` when auth is unconfigured."""

    try:
        return SupabaseJWTVerifier()
    except AuthenticationConfigurationError:
        # Do not turn an anonymous request into a 503 merely because the
        # authenticated service is not configured. The caller's credentials
        # must be evaluated first so missing Bearer auth consistently returns
        # 401. A supplied Bearer token with no verifier is handled below as a
        # genuine service-configuration failure.
        return None


def get_verified_supabase_claims(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None,
        Security(bearer_scheme),
    ],
    verifier: Annotated[
        SupabaseJWTVerifier | None,
        Depends(get_supabase_jwt_verifier),
    ],
) -> Mapping[str, Any]:
    """Require and verify a Supabase user bearer token."""

    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if verifier is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service is not configured.",
        )

    try:
        return verifier.verify(credentials.credentials)
    except TokenVerificationError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
