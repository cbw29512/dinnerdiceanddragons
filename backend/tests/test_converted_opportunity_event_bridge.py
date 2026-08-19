"""Regression coverage for the converted Table Match -> Event -> Player seat handoff."""

from onboarding_test_support import build_onboarding_client
from table_formation_api_test_support import seed_formation_api_match


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _formation_payload() -> dict:
    return {
        "title": "Production Bridge Table",
        "description": "A formed Event that remains actionable to its matched Player.",
        "event_type": "one_shot",
        "join_mode": "request_to_join",
        "minimum_age": None,
        "beginner_friendly": True,
        "expected_sessions": 1,
        "gm_message": None,
        "expectations": {
            "play_style": "Collaborative tabletop play.",
            "boundaries": "Respect the published table boundaries.",
            "new_players_welcome": True,
        },
    }


def test_converted_match_stays_visible_and_exposes_actionable_event_id() -> None:
    client, factory, engine = build_onboarding_client()
    try:
        for token in ("alice-token", "bob-token"):
            response = client.get("/api/v1/me", headers=_auth(token))
            assert response.status_code == 200, response.text

        match = seed_formation_api_match(factory)
        formed = client.post(
            f"/api/v1/matching/opportunities/{match.id}/form",
            headers=_auth("bob-token"),
            json=_formation_payload(),
        )
        assert formed.status_code == 200, formed.text
        event_id = formed.json()["event_id"]

        opportunities = client.get(
            "/api/v1/matching/opportunities",
            headers=_auth("alice-token"),
        )
        assert opportunities.status_code == 200, opportunities.text
        converted = next(
            item for item in opportunities.json() if item["id"] == str(match.id)
        )
        assert converted["status"] == "converted"
        assert converted["event_id"] == event_id
        assert converted["event_status"] == "venue_requested"
        assert converted["game_table_id"] is not None

        requested = client.post(
            f"/api/v1/events/{event_id}/registrations",
            headers=_auth("alice-token"),
            json={"expectations_acknowledged": True},
        )
        assert requested.status_code == 200, requested.text
        assert requested.json()["event_id"] == event_id
        assert requested.json()["status"] == "requested"
    finally:
        client.close()
        engine.dispose()
