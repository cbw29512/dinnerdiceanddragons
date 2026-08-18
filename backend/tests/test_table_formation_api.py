"""End-to-end authenticated HTTP tests for Step 4 table formation."""

import pytest
from onboarding_test_support import build_onboarding_client
from table_formation_api_test_support import seed_formation_api_match


@pytest.fixture()
def formation_api():
    client, factory, engine = build_onboarding_client()
    try:
        for token in ("alice-token", "bob-token"):
            response = client.get("/api/v1/me", headers=_auth(token))
            assert response.status_code == 200, response.text
        match = seed_formation_api_match(factory)
        yield client, match
    finally:
        client.close()
        engine.dispose()


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _formation_payload() -> dict:
    return {
        "title": "Shadows Over Florence",
        "description": "A one-shot built from a real three-sided Table Match.",
        "event_type": "one_shot",
        "join_mode": "request_to_join",
        "minimum_age": 18,
        "beginner_friendly": True,
        "expected_sessions": 1,
        "gm_message": "Please hold the quiet rear table.",
        "expectations": {
            "tone": "Adventurous and collaborative",
            "age_environment": "18+ adult table",
            "play_style": "High roleplay, medium combat, light puzzles.",
            "boundaries": "Respectful table; no PvP without consent.",
            "new_players_welcome": True,
            "safety_framework": "Lines, veils, and open-door policy.",
        },
    }


def test_non_owner_gm_role_cannot_form_another_gms_match(formation_api) -> None:
    client, match = formation_api

    response = client.post(
        f"/api/v1/matching/opportunities/{match.id}/form",
        headers=_auth("alice-token"),
        json=_formation_payload(),
    )

    assert response.status_code == 403
    assert response.json() == {"detail": "Not permitted for this opportunity."}


def test_table_match_conversion_is_idempotent(formation_api) -> None:
    client, match = formation_api

    first = client.post(
        f"/api/v1/matching/opportunities/{match.id}/form",
        headers=_auth("bob-token"),
        json=_formation_payload(),
    )
    second = client.post(
        f"/api/v1/matching/opportunities/{match.id}/form",
        headers=_auth("bob-token"),
        json=_formation_payload(),
    )

    assert first.status_code == 200, first.text
    assert second.status_code == 200, second.text
    assert first.json()["created"] is True
    assert second.json()["created"] is False
    for field in ("event_id", "venue_booking_request_id", "table_match_id"):
        assert first.json()[field] == second.json()[field]


def test_approval_and_minimum_commitment_drive_event_lifecycle(formation_api) -> None:
    client, match = formation_api

    formed = client.post(
        f"/api/v1/matching/opportunities/{match.id}/form",
        headers=_auth("bob-token"),
        json=_formation_payload(),
    )
    assert formed.status_code == 200, formed.text
    event_id = formed.json()["event_id"]
    booking_id = formed.json()["venue_booking_request_id"]
    assert formed.json()["event_status"] == "venue_requested"
    assert formed.json()["booking_status"] == "requested"

    requested = client.post(
        f"/api/v1/events/{event_id}/registrations",
        headers=_auth("alice-token"),
        json={"expectations_acknowledged": True},
    )
    assert requested.status_code == 200, requested.text
    assert requested.json()["status"] == "requested"
    registration_id = requested.json()["id"]

    confirmed = client.patch(
        f"/api/v1/events/{event_id}/registrations/{registration_id}",
        headers=_auth("bob-token"),
        json={"action": "confirm"},
    )
    assert confirmed.status_code == 200, confirmed.text
    assert confirmed.json()["status"] == "confirmed"

    before_venue = client.get(f"/api/v1/events/{event_id}", headers=_auth("alice-token"))
    assert before_venue.status_code == 200, before_venue.text
    assert before_venue.json()["status"] == "venue_requested"
    assert before_venue.json()["confirmed_players"] == 1
    assert before_venue.json()["booking"]["expected_guests"] == 2

    wrong_manager = client.patch(
        f"/api/v1/venue-bookings/{booking_id}",
        headers=_auth("alice-token"),
        json={"action": "approve"},
    )
    assert wrong_manager.status_code == 403

    approved = client.patch(
        f"/api/v1/venue-bookings/{booking_id}",
        headers=_auth("bob-token"),
        json={"action": "approve", "message": "Private Venue operational note."},
    )
    assert approved.status_code == 200, approved.text
    assert approved.json()["status"] == "approved"
    assert approved.json()["expected_guests"] == 2

    final = client.get(f"/api/v1/events/{event_id}", headers=_auth("alice-token"))
    assert final.status_code == 200, final.text
    body = final.json()
    assert body["status"] == "full"
    assert body["confirmed_players"] == 1
    assert body["booking"]["status"] == "approved"
    assert body["booking"]["expected_guests"] == 2
    assert body["your_registration"]["status"] == "confirmed"
    assert "venue_message" not in body["booking"]
    serialized = str(body).lower()
    for private_field in (
        "postal_code",
        "latitude",
        "longitude",
        "gm_message",
        "private venue operational note",
        "address_line1",
        "player_profile_id",
        "gm_profile_id",
        "user_id",
    ):
        assert private_field not in serialized
