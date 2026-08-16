"""Replacement-semantics tests for authenticated GM onboarding."""

from uuid import UUID

import pytest
from gm_onboarding_test_data import gm_payload
from onboarding_test_support import build_onboarding_client
from sqlalchemy import func, select

from app.models.availability_window import GMAvailabilityWindow
from app.models.gm_system_experience import GMSystemExperience, GMSystemFormat
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


def test_second_submission_replaces_gm_slice_without_new_profile(onboarding_context) -> None:
    client, factory = onboarding_context
    first = client.put("/api/v1/onboarding/gm", json=gm_payload(), headers=auth())
    assert first.status_code == 200, first.text

    profile_id = UUID(first.json()["gm_profile_id"])
    with factory() as session:
        first_rule_id = session.scalar(
            select(GMAvailabilityWindow.recurring_rule_id).where(
                GMAvailabilityWindow.gm_profile_id == profile_id
            )
        )
        assert first_rule_id is not None

    replacement = gm_payload()
    replacement["display_name"] = "Alice GM"
    replacement["beginner_friendly"] = False
    replacement["systems"][0].update(
        {
            "system_slug": "pathfinder-2e",
            "years_playing": 3.0,
            "years_gming": 1.5,
            "comfort_level": "comfortable",
            "formats": ["long_campaign"],
        }
    )
    replacement["availability"][0].update(
        {
            "day_of_week": "sunday",
            "start_time": "13:00",
            "end_time": "18:00",
        }
    )
    second = client.put(
        "/api/v1/onboarding/gm",
        json=replacement,
        headers=auth(),
    )
    assert second.status_code == 200, second.text
    assert second.json()["gm_profile_id"] == first.json()["gm_profile_id"]

    with factory() as session:
        experience = session.scalar(
            select(GMSystemExperience).where(GMSystemExperience.gm_profile_id == profile_id)
        )
        assert experience is not None
        assert str(experience.game_system_id) == "10000000-0000-0000-0000-000000000003"
        formats = set(
            session.scalars(
                select(GMSystemFormat.format).where(
                    GMSystemFormat.gm_system_experience_id == experience.id
                )
            ).all()
        )
        window_count = session.scalar(
            select(func.count())
            .select_from(GMAvailabilityWindow)
            .where(GMAvailabilityWindow.gm_profile_id == profile_id)
        )
        recurrence_count = session.scalar(
            select(func.count()).select_from(RecurringAvailabilityRule)
        )
        replacement_rule_id = session.scalar(
            select(GMAvailabilityWindow.recurring_rule_id).where(
                GMAvailabilityWindow.gm_profile_id == profile_id
            )
        )
        stale_rule = session.get(RecurringAvailabilityRule, first_rule_id)

        assert formats == {"long_campaign"}
        assert window_count == 1
        assert recurrence_count == 1
        assert replacement_rule_id is not None
        assert replacement_rule_id != first_rule_id
        assert stale_rule is None
