"""HTTP and persistence tests for authenticated Venue onboarding."""

import pytest
from onboarding_test_support import ALICE_SUBJECT, build_onboarding_client
from sqlalchemy import func, select
from venue_onboarding_test_data import venue_payload

from app.models.user import User
from app.models.user_role import UserRole
from app.models.venue import Venue, VenueManager


@pytest.fixture()
def onboarding_context():
    client, factory, engine = build_onboarding_client()
    try:
        yield client, factory
    finally:
        client.close()
        engine.dispose()


def auth(token: str = "alice-token") -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_venue_onboarding_requires_authentication(onboarding_context) -> None:
    client, _ = onboarding_context
    response = client.post("/api/v1/onboarding/venue", json=venue_payload())
    assert response.status_code == 401


def test_venue_onboarding_creates_pending_server_owned_claim(onboarding_context) -> None:
    client, factory = onboarding_context
    response = client.post(
        "/api/v1/onboarding/venue",
        json=venue_payload(),
        headers=auth(),
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["name"] == "Florence Game Night Cafe"
    assert body["role"] == "manager"
    assert body["venue_verified"] is False
    assert body["manager_verified"] is False
    assert body["slug"].startswith("florence-game-night-cafe-florence-sc-")
    assert "user_id" not in body and "email" not in body

    with factory() as session:
        user = session.scalar(select(User).where(User.auth_provider_user_id == ALICE_SUBJECT))
        assert user is not None
        venue = session.scalar(select(Venue))
        assert venue is not None
        assert str(venue.id) == body["venue_id"]
        assert venue.state_region == "SC"
        assert venue.verified is False
        assert venue.latitude is None and venue.longitude is None
        relationship = session.scalar(
            select(VenueManager).where(
                VenueManager.venue_id == venue.id,
                VenueManager.user_id == user.id,
            )
        )
        assert relationship is not None
        assert str(relationship.id) == body["venue_manager_id"]
        assert relationship.verified_at is None
        role_count = session.scalar(
            select(func.count())
            .select_from(UserRole)
            .where(UserRole.user_id == user.id, UserRole.role == "venue_manager")
        )
        assert role_count == 1


def test_duplicate_venue_is_rejected_without_second_claim(onboarding_context) -> None:
    client, factory = onboarding_context
    first = client.post(
        "/api/v1/onboarding/venue",
        json=venue_payload(),
        headers=auth("alice-token"),
    )
    assert first.status_code == 201

    second_payload = venue_payload()
    second_payload["name"] = "FLORENCE GAME NIGHT CAFE"
    second = client.post(
        "/api/v1/onboarding/venue",
        json=second_payload,
        headers=auth("bob-token"),
    )
    assert second.status_code == 409
    assert "already appears to exist" in second.text

    with factory() as session:
        venue_count = session.scalar(select(func.count()).select_from(Venue))
        relationship_count = session.scalar(select(func.count()).select_from(VenueManager))
        bob = session.scalar(select(User).where(User.email == "bob@example.com"))
        assert venue_count == 1
        assert relationship_count == 1
        assert bob is not None
        bob_role = session.scalar(
            select(UserRole).where(UserRole.user_id == bob.id, UserRole.role == "venue_manager")
        )
        assert bob_role is None
