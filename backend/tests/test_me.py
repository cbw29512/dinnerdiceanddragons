"""HTTP tests for the authenticated `/api/v1/me` endpoint."""

from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.dependencies.auth import get_supabase_jwt_verifier
from app.auth.supabase_jwt import TokenVerificationError
from app.db.session import get_db_session
from app.main import create_app
from app.models.user import AccountStatus, User

SUBJECT = "11111111-1111-1111-1111-111111111111"


class StubVerifier:
    """Small deterministic verifier used to test the HTTP authentication boundary."""

    def verify(self, token: str):
        if token == "expired-test-token":
            raise TokenVerificationError("expired test token")
        if token != "valid-test-token":
            raise TokenVerificationError("invalid test token")
        return {
            "sub": SUBJECT,
            "email": "Player@Example.COM",
            "aud": "authenticated",
            "iss": "https://example.supabase.co/auth/v1",
            "exp": 4102444800,
            "role": "authenticated",
            "is_anonymous": False,
            "user_metadata": {"private-example": "must-not-leak"},
        }


@pytest.fixture
def client_and_factory():
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    User.__table__.create(engine)
    factory = sessionmaker(bind=engine, class_=Session, expire_on_commit=False)

    application = create_app()
    application.dependency_overrides[get_supabase_jwt_verifier] = lambda: StubVerifier()

    def override_db_session():
        session = factory()
        try:
            yield session
        finally:
            session.close()

    application.dependency_overrides[get_db_session] = override_db_session
    try:
        yield TestClient(application), factory
    finally:
        engine.dispose()


def test_me_requires_bearer_authentication(client_and_factory) -> None:
    client, _ = client_and_factory
    response = client.get("/api/v1/me")

    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"
    assert response.json() == {"detail": "Authentication required."}


@pytest.mark.parametrize("token", ["invalid-test-token", "expired-test-token"])
def test_me_rejects_invalid_or_expired_token(client_and_factory, token: str) -> None:
    client, _ = client_and_factory
    response = client.get(
        "/api/v1/me",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"
    assert response.json() == {"detail": "Invalid or expired access token."}
    assert token not in response.text


def test_me_creates_and_returns_durable_user_without_leaking_raw_claims(
    client_and_factory,
) -> None:
    client, factory = client_and_factory
    response = client.get(
        "/api/v1/me",
        headers={"Authorization": "Bearer valid-test-token"},
    )

    assert response.status_code == 200
    body = response.json()
    assert UUID(body["ddd_user_id"])
    assert body == {
        "ddd_user_id": body["ddd_user_id"],
        "auth_provider": "supabase",
        "auth_provider_user_id": SUBJECT,
        "email": "player@example.com",
        "display_name": None,
        "status": AccountStatus.ACTIVE.value,
    }
    assert "user_metadata" not in response.text
    assert "valid-test-token" not in response.text

    with factory() as session:
        persisted = session.scalar(select(User).where(User.auth_provider_user_id == SUBJECT))
        assert persisted is not None
        assert str(persisted.id) == body["ddd_user_id"]
        assert persisted.email_verified_at is not None
        assert persisted.last_login_at is not None


def test_repeated_me_request_reuses_same_durable_user(client_and_factory) -> None:
    client, factory = client_and_factory
    headers = {"Authorization": "Bearer valid-test-token"}

    first = client.get("/api/v1/me", headers=headers)
    second = client.get("/api/v1/me", headers=headers)

    assert first.status_code == 200
    assert second.status_code == 200
    assert second.json()["ddd_user_id"] == first.json()["ddd_user_id"]

    with factory() as session:
        users = session.scalars(select(User)).all()
        assert len(users) == 1


def test_me_refuses_email_collision_with_different_provider_subject(client_and_factory) -> None:
    client, factory = client_and_factory
    with factory() as session:
        session.add(
            User(
                auth_provider_user_id="22222222-2222-2222-2222-222222222222",
                email="player@example.com",
                status=AccountStatus.ACTIVE.value,
            )
        )
        session.commit()

    response = client.get(
        "/api/v1/me",
        headers={"Authorization": "Bearer valid-test-token"},
    )

    assert response.status_code == 409
    assert response.json() == {
        "detail": "This sign-in could not be safely linked to a DDD account."
    }


def test_public_health_route_stays_anonymous(client_and_factory) -> None:
    client, _ = client_and_factory
    response = client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"
