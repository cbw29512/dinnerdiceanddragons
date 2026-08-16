"""Replacement-semantics tests for authenticated Player onboarding."""

from uuid import UUID

import pytest
from onboarding_test_support import build_onboarding_client, player_payload
from sqlalchemy import func, select

from app.models.availability_window import PlayerAvailabilityWindow
from app.models.player_system_experience import PlayerSystemExperience


@pytest.fixture()
def onboarding_context():
    client, factory, engine = build_onboarding_client()
    try:
        yield client, factory
    finally:
        client.close()
        engine.dispose()


def auth() -> dict[str, str]:
    return {"Authorization": "Bearer alice-token"}


def test_second_submission_replaces_player_slice_without_new_profile(onboarding_context) -> None:
    client, factory = onboarding_context
    first = client.put("/api/v1/onboarding/player", json=player_payload(), headers=auth())
    assert first.status_code == 200

    replacement = player_payload()
    replacement["display_name"] = "Alice Updated"
    replacement["systems"][0].update(
        {
            "system_slug": "pathfinder-2e",
            "years_playing": 1.5,
            "comfort_level": "learning",
        }
    )
    replacement["availability"][0].update(
        {
            "day_of_week": "sunday",
            "start_time": "14:00",
            "end_time": "18:00",
        }
    )
    second = client.put(
        "/api/v1/onboarding/player",
        json=replacement,
        headers=auth(),
    )
    assert second.status_code == 200, second.text
    assert second.json()["player_profile_id"] == first.json()["player_profile_id"]

    with factory() as session:
        profile_id = UUID(first.json()["player_profile_id"])
        experience_count = session.scalar(
            select(func.count()).select_from(PlayerSystemExperience).where(
                PlayerSystemExperience.player_profile_id == profile_id
            )
        )
        window_count = session.scalar(
            select(func.count()).select_from(PlayerAvailabilityWindow).where(
                PlayerAvailabilityWindow.player_profile_id == profile_id
            )
        )
        assert experience_count == 1
        assert window_count == 1
