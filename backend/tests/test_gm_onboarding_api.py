"""HTTP and persistence tests for authenticated GM onboarding."""

import pytest
from gm_onboarding_test_data import gm_payload
from onboarding_test_support import ALICE_SUBJECT, build_onboarding_client
from sqlalchemy import func, select

from app.models.availability_window import GMAvailabilityWindow
from app.models.gm_profile import GMProfile
from app.models.gm_system_experience import GMSystemExperience, GMSystemFormat
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


def test_gm_onboarding_requires_authentication(onboarding_context) -> None:
    client, _ = onboarding_context
    response = client.put("/api/v1/onboarding/gm", json=gm_payload())
    assert response.status_code == 401


def test_gm_onboarding_persists_server_owned_state(onboarding_context) -> None:
    client, factory = onboarding_context
    response = client.put(
        "/api/v1/onboarding/gm",
        json=gm_payload(),
        headers=auth(),
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["display_name"] == "Alice Adventurer"
    assert body["role"] == "gm"
    assert body["system_slugs"] == ["dnd-5e-2014"]
    assert body["availability_count"] == 1
    assert "email" not in body and "user_id" not in body

    with factory() as session:
        user = session.scalar(select(User).where(User.auth_provider_user_id == ALICE_SUBJECT))
        assert user is not None
        assert user.email == "alice@example.com"
        profile = session.scalar(select(GMProfile).where(GMProfile.user_id == user.id))
        assert profile is not None
        assert str(profile.id) == body["gm_profile_id"]
        assert profile.beginner_friendly is True
        assert "tactical combat" in profile.gm_style
        gm_role_count = session.scalar(
            select(func.count())
            .select_from(UserRole)
            .where(UserRole.user_id == user.id, UserRole.role == "gm")
        )
        assert gm_role_count == 1

        experience = session.scalar(
            select(GMSystemExperience).where(GMSystemExperience.gm_profile_id == profile.id)
        )
        assert experience is not None
        assert str(experience.game_system_id) == "10000000-0000-0000-0000-000000000001"
        formats = set(
            session.scalars(
                select(GMSystemFormat.format).where(
                    GMSystemFormat.gm_system_experience_id == experience.id
                )
            ).all()
        )
        assert formats == {"one_shot", "short_campaign"}
        window = session.scalar(
            select(GMAvailabilityWindow).where(GMAvailabilityWindow.gm_profile_id == profile.id)
        )
        assert window is not None and window.active is True


def test_client_cannot_supply_gm_identity_or_profile_owner(onboarding_context) -> None:
    client, _ = onboarding_context
    payload = gm_payload()
    payload.update(
        {
            "user_id": "00000000-0000-0000-0000-000000000999",
            "gm_id": "00000000-0000-0000-0000-000000000998",
            "email": "forged@example.com",
        }
    )
    response = client.put("/api/v1/onboarding/gm", json=payload, headers=auth())
    assert response.status_code == 422
    assert "user_id" in response.text
    assert "gm_id" in response.text
    assert "email" in response.text


def test_unknown_system_rolls_back_gm_state(onboarding_context) -> None:
    client, factory = onboarding_context
    payload = gm_payload()
    payload["systems"][0]["system_slug"] = "missing-system"
    response = client.put("/api/v1/onboarding/gm", json=payload, headers=auth())
    assert response.status_code == 422
    assert "missing-system" in response.text

    with factory() as session:
        user = session.scalar(select(User).where(User.auth_provider_user_id == ALICE_SUBJECT))
        assert user is not None
        profile = session.scalar(select(GMProfile).where(GMProfile.user_id == user.id))
        gm_role = session.scalar(
            select(UserRole).where(UserRole.user_id == user.id, UserRole.role == "gm")
        )
        assert profile is None
        assert gm_role is None
