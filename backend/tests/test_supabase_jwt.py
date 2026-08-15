"""Tests for Supabase JWT verification in the production API."""

from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa

from app.auth.supabase_jwt import (
    AuthenticationConfigurationError,
    SupabaseJWTVerifier,
    TokenVerificationError,
)
from app.core.config import Settings

ISSUER = "https://example.supabase.co/auth/v1"
AUDIENCE = "authenticated"
SUBJECT = "11111111-1111-1111-1111-111111111111"


class StaticJWKClient:
    """Return one test public key without making a network request."""

    def __init__(self, public_key) -> None:
        self.public_key = public_key

    def get_signing_key_from_jwt(self, _token: str):
        return SimpleNamespace(key=self.public_key)


def make_settings() -> Settings:
    return Settings(
        _env_file=None,
        supabase_url="https://example.supabase.co",
        supabase_jwt_audience=AUDIENCE,
    )


def make_keys():
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    return private_key, private_key.public_key()


def make_token(private_key, **overrides) -> str:
    now = datetime.now(UTC)
    claims = {
        "sub": SUBJECT,
        "iss": ISSUER,
        "aud": AUDIENCE,
        "iat": now,
        "exp": now + timedelta(minutes=5),
        "email": "player@example.com",
        "role": "authenticated",
    }
    claims.update(overrides)
    return jwt.encode(
        claims,
        private_key,
        algorithm="RS256",
        headers={"kid": "test-signing-key"},
    )


def make_verifier(public_key) -> SupabaseJWTVerifier:
    return SupabaseJWTVerifier(
        settings=make_settings(),
        jwks_client=StaticJWKClient(public_key),
    )


def test_verifier_requires_supabase_url() -> None:
    settings = Settings(_env_file=None, supabase_url=None)

    with pytest.raises(AuthenticationConfigurationError):
        SupabaseJWTVerifier(settings=settings)


def test_verifier_builds_project_issuer_and_jwks_url() -> None:
    _, public_key = make_keys()
    verifier = make_verifier(public_key)

    assert verifier.issuer == ISSUER
    assert verifier.jwks_url == f"{ISSUER}/.well-known/jwks.json"


def test_valid_asymmetric_supabase_token_is_accepted() -> None:
    private_key, public_key = make_keys()
    claims = make_verifier(public_key).verify(make_token(private_key))

    assert claims["sub"] == SUBJECT
    assert claims["aud"] == AUDIENCE
    assert claims["iss"] == ISSUER


def test_token_with_wrong_signature_is_rejected() -> None:
    trusted_private_key, trusted_public_key = make_keys()
    attacker_private_key, _ = make_keys()
    del trusted_private_key

    with pytest.raises(TokenVerificationError):
        make_verifier(trusted_public_key).verify(make_token(attacker_private_key))


@pytest.mark.parametrize(
    ("override", "value"),
    [
        ("iss", "https://wrong-project.supabase.co/auth/v1"),
        ("aud", "service_role"),
        ("exp", datetime.now(UTC) - timedelta(seconds=1)),
    ],
)
def test_registered_security_claim_mismatch_is_rejected(override: str, value) -> None:
    private_key, public_key = make_keys()

    with pytest.raises(TokenVerificationError):
        make_verifier(public_key).verify(make_token(private_key, **{override: value}))


def test_missing_required_expiration_is_rejected() -> None:
    private_key, public_key = make_keys()
    now = datetime.now(UTC)
    token = jwt.encode(
        {"sub": SUBJECT, "iss": ISSUER, "aud": AUDIENCE, "iat": now},
        private_key,
        algorithm="RS256",
        headers={"kid": "test-signing-key"},
    )

    with pytest.raises(TokenVerificationError):
        make_verifier(public_key).verify(token)


def test_legacy_hs256_token_is_rejected_before_key_lookup() -> None:
    _, public_key = make_keys()
    token = jwt.encode(
        {
            "sub": SUBJECT,
            "iss": ISSUER,
            "aud": AUDIENCE,
            "exp": datetime.now(UTC) + timedelta(minutes=5),
        },
        "legacy-secret-not-trusted-by-ddd",
        algorithm="HS256",
        headers={"kid": "legacy-key"},
    )

    with pytest.raises(TokenVerificationError, match="algorithm"):
        make_verifier(public_key).verify(token)
