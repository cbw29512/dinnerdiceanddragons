"""Replacement-semantics tests for authenticated Player onboarding."""

from uuid import UUID

import pytest
from onboarding_test_support import build_onboarding_client
from player_onboarding_test_data import player_payload
from sqlalchemy import func, select

from app.models.availability_window import PlayerAvailabilityWindow
from app.models.player_system_experience import PlayerSystemExperience
from app.models.recurring_availability_rule import RecurringAvailabilityRule


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

    profile_id = UUID(first.json()["player_profile_id"])
    with factory() as session:
        first_rule_id = session.scalar(
            select(PlayerAvailabilityWindow.recurring_rule_id).where(
                PlayerAvailabilityWindow.player_profile_id == profile_id
            )
        )
        assert first_rule_id is not None

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
        experience_count = session.scalar(
            select(func.count())
            .select_from(PlayerSystemExperience)
            .where(PlayerSystemExperience.player_profile_id == profile_id)
        )
        window_count = session.scalar(
            select(func.count())
            .select_from(PlayerAvailabilityWindow)
            .where(PlayerAvailabilityWindow.player_profile_id == profile_id)
        )
        recurrence_count = session.scalar(
            select(func.count()).select_from(RecurringAvailabilityRule)
        )
        replacement_rule_id = session.scalar(
            select(PlayerAvailabilityWindow.recurring_rule_id).where(
                PlayerAvailabilityWindow.player_profile_id == profile_id
            )
        )
        stale_rule = session.get(RecurringAvailabilityRule, first_rule_id)

        assert experience_count == 1
        assert window_count == 1
        assert recurrence_count == 1
        assert replacement_rule_id is not None
        assert replacement_rule_id != first_rule_id
        assert stale_rule is None
