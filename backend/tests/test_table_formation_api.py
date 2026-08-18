"""Authenticated end-to-end API tests from TableMatch formation through confirmation."""

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
        shared_id, _, _, _ = seed_api_matches(factory)
        yield client, shared_id
    finally:
        client.close()
        engine.dispose()


def test_full_authenticated_formation_flow(api_context) -> None:
    client, match_id = api_context

    formed = client.post(
        f"/api/v1/matching/opportunities/{match_id}/form",
        headers=_auth("bob-token"),
        json={"title": "Friday Night Dragons", "description": "A real formed table."},
    )
    assert formed.status_code == 200, formed.text
    formation = formed.json()
    assert formation["created"] is True
    event_id = formation["event_id"]
    booking_id = formation["venue_booking_request_id"]

    retry = client.post(
        f"/api/v1/matching/opportunities/{match_id}/form",
        headers=_auth("bob-token"),
        json={"title": "Ignored Retry"},
    )
    assert retry.status_code == 200, retry.text
    assert retry.json()["created"] is False
    assert retry.json()["event_id"] == event_id

    player_events = client.get("/api/v1/events", headers=_auth("alice-token"))
    assert player_events.status_code == 200, player_events.text
    assert [item["id"] for item in player_events.json()] == [event_id]
    player_summary = player_events.json()[0]
    assert player_summary["viewer_roles"] == ["player"]
    assert player_summary["booking_id"] is None
    assert player_summary["booking_status"] == "requested"
    _assert_no_private_location_fields(player_summary)

    requested = client.post(
        f"/api/v1/events/{event_id}/registrations",
        headers=_auth("alice-token"),
        json={"expectations_acknowledged": True},
    )
    assert requested.status_code == 200, requested.text
    registration = requested.json()
    assert registration["status"] == "requested"
    assert registration["event_status"] == "venue_requested"
    registration_id = registration["registration_id"]

    queue = client.get(
        f"/api/v1/events/{event_id}/registrations",
        headers=_auth("bob-token"),
    )
    assert queue.status_code == 200, queue.text
    assert queue.json()[0]["id"] == registration_id
    assert queue.json()[0]["expectations_acknowledged"] is True
    assert "email" not in str(queue.json()).lower()
    assert "postal" not in str(queue.json()).lower()

    confirmed = client.patch(
        f"/api/v1/events/{event_id}/registrations/{registration_id}",
        headers=_auth("bob-token"),
        json={"status": "confirmed"},
    )
    assert confirmed.status_code == 200, confirmed.text
    assert confirmed.json()["status"] == "confirmed"
    assert confirmed.json()["event_status"] == "venue_requested"
    assert confirmed.json()["expected_guests"] == 2

    approved = client.patch(
        f"/api/v1/venue-bookings/{booking_id}",
        headers=_auth("bob-token"),
        json={"status": "approved"},
    )
    assert approved.status_code == 200, approved.text
    assert approved.json()["event_status"] == "confirmed"
    assert approved.json()["expected_guests"] == 2

    detail = client.get(
        f"/api/v1/events/{event_id}",
        headers=_auth("alice-token"),
    )
    assert detail.status_code == 200, detail.text
    body = detail.json()
    assert body["status"] == "confirmed"
    assert body["confirmed_players"] == 1
    assert body["expected_guests"] == 2
    assert body["your_registration_id"] == registration_id
    assert body["your_registration_status"] == "confirmed"
    assert body["booking_id"] is None
    assert "expectations" in body
    _assert_no_private_location_fields(body)


def _assert_no_private_location_fields(payload: object) -> None:
    serialized = str(payload).lower()
    for forbidden in (
        "postal_code",
        "latitude",
        "longitude",
        "address_line1",
        "email",
        "user_id",
        "gm_profile_id",
    ):
        assert forbidden not in serialized
