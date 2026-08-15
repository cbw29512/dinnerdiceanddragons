"""HTTP tests for the authenticated `/api/v1/me` endpoint."""

from fastapi.testclient import TestClient

from app.api.dependencies.auth import get_supabase_jwt_verifier
from app.auth.supabase_jwt import TokenVerificationError
from app.main import create_app


class StubVerifier:
    """Small deterministic verifier used to test the HTTP authentication boundary."""

    def verify(self, token: str):
        if token != "valid-test-token":
            raise TokenVerificationError("invalid test token")
        return {
            "sub": "11111111-1111-1111-1111-111111111111",
            "email": "player@example.com",
            "aud": "authenticated",
            "iss": "https://example.supabase.co/auth/v1",
            "exp": 4102444800,
            "role": "authenticated",
            "user_metadata": {"private-example": "must-not-leak"},
        }


def make_client() -> TestClient:
    application = create_app()
    application.dependency_overrides[get_supabase_jwt_verifier] = lambda: StubVerifier()
    return TestClient(application)


def test_me_requires_bearer_authentication() -> None:
    response = make_client().get("/api/v1/me")

    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"
    assert response.json() == {"detail": "Authentication required."}


def test_me_rejects_invalid_token() -> None:
    response = make_client().get(
        "/api/v1/me",
        headers={"Authorization": "Bearer invalid-test-token"},
    )

    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"
    assert response.json() == {"detail": "Invalid or expired access token."}


def test_me_returns_only_safe_verified_principal_fields() -> None:
    response = make_client().get(
        "/api/v1/me",
        headers={"Authorization": "Bearer valid-test-token"},
    )

    assert response.status_code == 200
    assert response.json() == {
        "auth_provider": "supabase",
        "auth_provider_user_id": "11111111-1111-1111-1111-111111111111",
        "email": "player@example.com",
    }
    assert "user_metadata" not in response.text
    assert "valid-test-token" not in response.text


def test_public_health_route_stays_anonymous() -> None:
    response = make_client().get("/api/v1/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"
