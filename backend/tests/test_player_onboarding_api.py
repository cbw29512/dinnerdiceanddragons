"""HTTP and persistence tests for authenticated Player onboarding."""

import pytest
from onboarding_test_support import ALICE_SUBJECT, build_onboarding_client
from player_onboarding_test_data import player_payload
from sqlalchemy import func, select

from app.models.availability_window import PlayerAvailabilityWindow
from app.models.player_profile import PlayerProfile
from app.models.player_system_experience import PlayerSystemExperience
from app.models.user import User
from app.models.user_role import UserRole


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


def test_player_onboarding_requires_authentication(onboarding_context) -> None:
    client, _ = onboarding_context
    response = client.put("/api/v1/onboarding/player", json=player_payload())
    assert response.status_code == 401


def test_player_onboarding_persists_server_owned_state(onboarding_context) -> None:
    client, factory = onboarding_context
    response = client.put(
        "/api/v1/onboarding/player",
        json=player_payload(),
        headers=auth(),
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["display_name"] == "Alice Adventurer"
    assert body["role"] == "player"
    assert body["system_slugs"] == ["dnd-5e-2014"]
    assert body["availability_count"] == 1
    assert "email" not in body and "user_id" not in body

    with factory() as session:
        user = session.scalar(
            select(User).where(User.auth_provider_user_id == ALICE_SUBJECT)
        )
        assert user is not None
        assert user.email == "alice@example.com"
        assert user.display_name_normalized == "alice adventurer"
        profile = session.scalar(
            select(PlayerProfile).where(PlayerProfile.user_id == user.id)
        )
        assert profile is not None
        assert str(profile.id) == body["player_profile_id"]
        assert profile.postal_code == "29501"
        assert profile.environment_preferences == ["quieter venue"]
        player_role_count = session.scalar(
            select(func.count()).select_from(UserRole).where(
                UserRole.user_id == user.id,
                UserRole.role == "player",
            )
        )
        assert player_role_count == 1
        experience = session.scalar(
            select(PlayerSystemExperience).where(
                PlayerSystemExperience.player_profile_id == profile.id
            )
        )
        assert experience is not None
        assert str(experience.game_system_id) == "10000000-0000-0000-0000-000000000001"
        window = session.scalar(
            select(PlayerAvailabilityWindow).where(
                PlayerAvailabilityWindow.player_profile_id == profile.id
            )
        )
        assert window is not None and window.active is True


def test_client_cannot_supply_identity_or_profile_owner(onboarding_context) -> None:
    client, _ = onboarding_context
    payload = player_payload()
    payload.update(
        {
            "user_id": "00000000-0000-0000-0000-000000000999",
            "player_id": "00000000-0000-0000-0000-000000000998",
            "email": "forged@example.com",
        }
    )
    response = client.put("/api/v1/onboarding/player", json=payload, headers=auth())
    assert response.status_code == 422
    error_text = response.text
    assert "user_id" in error_text
    assert "player_id" in error_text
    assert "email" in error_text


def test_unknown_system_rolls_back_player_state(onboarding_context) -> None:
    client, factory = onboarding_context
    payload = player_payload()
    payload["systems"][0]["system_slug"] = "missing-system"
    response = client.put("/api/v1/onboarding/player", json=payload, headers=auth())
    assert response.status_code == 422
    assert "missing-system" in response.text

    with factory() as session:
        user = session.scalar(
            select(User).where(User.auth_provider_user_id == ALICE_SUBJECT)
        )
        assert user is not None
        profile = session.scalar(
            select(PlayerProfile).where(PlayerProfile.user_id == user.id)
        )
        player_role = session.scalar(
            select(UserRole).where(UserRole.user_id == user.id, UserRole.role == "player")
        )
        assert profile is None
        assert player_role is None
