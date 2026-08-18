"""Verify Supabase Auth user access tokens against the project's JWKS."""

import logging
from collections.abc import Mapping
from typing import Any

import jwt
from jwt import PyJWKClient
from jwt.exceptions import PyJWTError

from app.core.config import Settings, get_settings

LOGGER = logging.getLogger(__name__)

# DDD deliberately accepts only asymmetric signing algorithms. This avoids
# trusting the legacy Supabase shared JWT secret in the application process.
ALLOWED_ALGORITHMS = ("ES256", "RS256", "EdDSA")
JWKS_CACHE_SECONDS = 300


class AuthenticationConfigurationError(RuntimeError):
    """Raised when production authentication is missing required configuration."""


class TokenVerificationError(ValueError):
    """Raised when a bearer token cannot be trusted as a Supabase user token."""


class SupabaseJWTVerifier:
    """Verify Supabase JWT signature and registered security claims."""

    def __init__(
        self,
        settings: Settings | None = None,
        jwks_client: PyJWKClient | None = None,
    ) -> None:
        self.settings = settings or get_settings()
        if self.settings.supabase_url is None:
            raise AuthenticationConfigurationError(
                "SUPABASE_URL is required before authenticated API routes can be enabled."
            )

        base_url = str(self.settings.supabase_url).rstrip("/")
        self.issuer = f"{base_url}/auth/v1"
        self.jwks_url = f"{self.issuer}/.well-known/jwks.json"
        self.jwks_client = jwks_client or PyJWKClient(
            self.jwks_url,
            cache_jwk_set=True,
            lifespan=JWKS_CACHE_SECONDS,
            cache_keys=False,
            timeout=self.settings.outbound_http_timeout_seconds,
        )

    def verify(self, token: str) -> Mapping[str, Any]:
        """Return verified JWT claims or raise ``TokenVerificationError``."""

        if not token or not token.strip():
            raise TokenVerificationError("Bearer token is missing.")

        try:
            header = jwt.get_unverified_header(token)
            algorithm = header.get("alg")
            key_id = header.get("kid")
            if algorithm not in ALLOWED_ALGORITHMS:
                raise TokenVerificationError("JWT signing algorithm is not allowed.")
            if not key_id:
                raise TokenVerificationError("JWT signing key identifier is missing.")

            signing_key = self.jwks_client.get_signing_key_from_jwt(token)
            claims = jwt.decode(
                token,
                signing_key.key,
                algorithms=list(ALLOWED_ALGORITHMS),
                audience=self.settings.supabase_jwt_audience,
                issuer=self.issuer,
                options={"require": ["aud", "exp", "iss", "sub"]},
            )
            return claims
        except TokenVerificationError:
            raise
        except PyJWTError as exc:
            LOGGER.info("Supabase JWT verification rejected a token: %s", type(exc).__name__)
            raise TokenVerificationError("Bearer token is invalid or expired.") from exc
        except Exception as exc:
            LOGGER.exception("Unexpected failure while verifying a Supabase JWT")
            raise TokenVerificationError("Bearer token could not be verified.") from exc
