"""Authenticated API tests for GM-owned Event expectations editing."""

import pytest
from onboarding_test_support import build_onboarding_client
from table_match_api_test_support import seed_api_matches


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def api_context():
    client, factory, engine = build_onboarding_client()
    try:
        for token in ("alice-token", "bob-token"):
            response = client.get("/api/v1/me", headers=_auth(token))
            assert response.status_code == 200, response.text
        match_id, _, _, _ = seed_api_matches(factory)
        formed = client.post(
            f"/api/v1/matching/opportunities/{match_id}/form",
            headers=_auth("bob-token"),
            json={"title": "Expectations API"},
        )
        assert formed.status_code == 200, formed.text
        yield client, formed.json()["event_id"]
    finally:
        client.close()
        engine.dispose()


def test_gm_updates_expectations_before_registration(api_context) -> None:
    client, event_id = api_context

    response = client.patch(
        f"/api/v1/events/{event_id}/expectations",
        headers=_auth("bob-token"),
        json={
            "tone": "Heroic and collaborative",
            "pvp_policy": "No PvP without unanimous consent.",
            "safety_framework": "Lines and veils plus X-card.",
            "new_players_welcome": True,
        },
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["tone"] == "Heroic and collaborative"
    assert body["pvp_policy"] == "No PvP without unanimous consent."
    assert body["new_players_welcome"] is True


def test_player_cannot_edit_expectations(api_context) -> None:
    client, event_id = api_context

    response = client.patch(
        f"/api/v1/events/{event_id}/expectations",
        headers=_auth("alice-token"),
        json={"tone": "Unauthorized"},
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "Resource not found."}


def test_expectations_api_freezes_after_first_registration(api_context) -> None:
    client, event_id = api_context
    requested = client.post(
        f"/api/v1/events/{event_id}/registrations",
        headers=_auth("alice-token"),
        json={"expectations_acknowledged": True},
    )
    assert requested.status_code == 200, requested.text

    response = client.patch(
        f"/api/v1/events/{event_id}/expectations",
        headers=_auth("bob-token"),
        json={"tone": "Too Late"},
    )

    assert response.status_code == 409
    assert "frozen" in response.json()["detail"].lower()
