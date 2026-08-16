"""Negative and cross-user boundary tests for Player onboarding."""

import pytest
from sqlalchemy import func, select

from app.models.player_profile import PlayerProfile
from app.models.user import User
from app.models.user_role import UserRole
from onboarding_test_support import build_onboarding_client, player_payload


@pytest.fixture()
def onboarding_context():
    client, factory, engine = build_onboarding_client()
    try:
        yield client, factory
    finally:
        client.close()
        engine.dispose()


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_invalid_timezone_is_rejected_before_persistence(onboarding_context) -> None:
    client, factory = onboarding_context
    payload = player_payload()
    payload["availability"][0]["timezone"] = "Mars/Olympus_Mons"
    response = client.put(
        "/api/v1/onboarding/player",
        json=payload,
        headers=auth("alice-token"),
    )
    assert response.status_code == 422
    assert "valid IANA timezone" in response.text

    with factory() as session:
        assert session.scalar(select(func.count()).select_from(PlayerProfile)) == 0


def test_display_name_conflict_does_not_create_second_player(onboarding_context) -> None:
    client, factory = onboarding_context
    alice = client.put(
        "/api/v1/onboarding/player",
        json=player_payload(),
        headers=auth("alice-token"),
    )
    assert alice.status_code == 200

    bob_payload = player_payload()
    bob_payload["display_name"] = "  ALICE   ADVENTURER  "
    bob = client.put(
        "/api/v1/onboarding/player",
        json=bob_payload,
        headers=auth("bob-token"),
    )
    assert bob.status_code == 409
    assert "already in use" in bob.text

    with factory() as session:
        bob_user = session.scalar(select(User).where(User.email == "bob@example.com"))
        assert bob_user is not None
        assert session.scalar(
            select(PlayerProfile).where(PlayerProfile.user_id == bob_user.id)
        ) is None
        assert session.scalar(
            select(UserRole).where(UserRole.user_id == bob_user.id, UserRole.role == "player")
        ) is None


def test_two_users_receive_independent_player_profiles(onboarding_context) -> None:
    client, factory = onboarding_context
    alice_payload = player_payload()
    bob_payload = player_payload()
    bob_payload["display_name"] = "Bob Builder"
    bob_payload["postal_code"] = "29505"

    alice = client.put(
        "/api/v1/onboarding/player",
        json=alice_payload,
        headers=auth("alice-token"),
    )
    bob = client.put(
        "/api/v1/onboarding/player",
        json=bob_payload,
        headers=auth("bob-token"),
    )
    assert alice.status_code == 200
    assert bob.status_code == 200
    assert alice.json()["player_profile_id"] != bob.json()["player_profile_id"]

    with factory() as session:
        profiles = session.scalars(select(PlayerProfile).order_by(PlayerProfile.postal_code)).all()
        assert len(profiles) == 2
        assert {profile.postal_code for profile in profiles} == {"29501", "29505"}
