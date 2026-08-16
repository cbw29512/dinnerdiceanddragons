"""Authenticated round-trip tests for onboarding readback APIs."""

import pytest
from gm_onboarding_test_data import gm_payload
from onboarding_test_support import build_onboarding_client
from player_onboarding_test_data import player_payload


@pytest.fixture()
def onboarding_context():
    client, _, engine = build_onboarding_client()
    try:
        yield client
    finally:
        client.close()
        engine.dispose()


def auth(token: str = "alice-token") -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_onboarding_readback_requires_authentication(onboarding_context) -> None:
    client = onboarding_context
    assert client.get("/api/v1/onboarding/player").status_code == 401
    assert client.get("/api/v1/onboarding/gm").status_code == 401


def test_missing_owner_state_returns_404(onboarding_context) -> None:
    client = onboarding_context
    player = client.get("/api/v1/onboarding/player", headers=auth())
    gm = client.get("/api/v1/onboarding/gm", headers=auth())
    assert player.status_code == 404
    assert gm.status_code == 404
    assert "has not been created" in player.text
    assert "has not been created" in gm.text


def test_player_onboarding_round_trips_without_identity_fields(onboarding_context) -> None:
    client = onboarding_context
    payload = player_payload()
    saved = client.put("/api/v1/onboarding/player", json=payload, headers=auth())
    assert saved.status_code == 200, saved.text

    loaded = client.get("/api/v1/onboarding/player", headers=auth())
    assert loaded.status_code == 200, loaded.text
    body = loaded.json()
    assert body["display_name"] == payload["display_name"]
    assert body["postal_code"] == payload["postal_code"]
    assert body["travel_radius_miles"] == payload["travel_radius_miles"]
    assert body["systems"][0]["system_slug"] == "dnd-5e-2014"
    assert body["systems"][0]["comfort_level"] == "comfortable"
    assert body["availability"][0]["day_of_week"] == "saturday"
    assert body["availability"][0]["timezone"] == "America/New_York"
    assert "email" not in body
    assert "user_id" not in body
    assert "player_profile_id" not in body


def test_gm_onboarding_round_trips_formats_without_identity_fields(onboarding_context) -> None:
    client = onboarding_context
    payload = gm_payload()
    saved = client.put("/api/v1/onboarding/gm", json=payload, headers=auth())
    assert saved.status_code == 200, saved.text

    loaded = client.get("/api/v1/onboarding/gm", headers=auth())
    assert loaded.status_code == 200, loaded.text
    body = loaded.json()
    assert body["display_name"] == payload["display_name"]
    assert body["beginner_friendly"] is True
    assert body["systems"][0]["system_slug"] == "dnd-5e-2014"
    assert set(body["systems"][0]["formats"]) == {"one_shot", "short_campaign"}
    assert body["availability"][0]["day_of_week"] == "saturday"
    assert "email" not in body
    assert "user_id" not in body
    assert "gm_profile_id" not in body


def test_onboarding_readback_is_isolated_by_authenticated_user(onboarding_context) -> None:
    client = onboarding_context
    saved = client.put("/api/v1/onboarding/player", json=player_payload(), headers=auth())
    assert saved.status_code == 200

    bob = client.get("/api/v1/onboarding/player", headers=auth("bob-token"))
    assert bob.status_code == 404
