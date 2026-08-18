"""HTTP tests for verified Venue booking lifecycle decisions."""

import pytest
from onboarding_test_support import build_onboarding_client
from table_formation_api_test_support import seed_formation_api_match

from app.models.venue_booking_request import VenueBookingRequest
from app.models.venue_table_window import VenueTableWindow


@pytest.fixture()
def booking_api():
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
        yield (
            client,
            factory,
            formed.json()["event_id"],
            formed.json()["venue_booking_request_id"],
        )
    finally:
        client.close()
        engine.dispose()


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _formation_payload() -> dict:
    return {
        "title": "Venue Lifecycle Night",
        "description": "Formation booking lifecycle test.",
        "event_type": "one_shot",
        "join_mode": "request_to_join",
        "expected_sessions": 1,
        "expectations": {
            "play_style": "Collaborative.",
            "boundaries": "Respectful table.",
        },
    }


def test_venue_question_keeps_event_waiting_for_approval(booking_api) -> None:
    client, _, event_id, booking_id = booking_api

    response = client.patch(
        f"/api/v1/venue-bookings/{booking_id}",
        headers=_auth("bob-token"),
        json={"action": "question", "message": "Can the start move by 30 minutes?"},
    )

    assert response.status_code == 200, response.text
    assert response.json()["status"] == "question"
    event = client.get(f"/api/v1/events/{event_id}", headers=_auth("bob-token"))
    assert event.status_code == 200, event.text
    assert event.json()["status"] == "venue_requested"
    assert "venue_message" not in event.json()["booking"]


def test_venue_decline_cancels_event(booking_api) -> None:
    client, _, event_id, booking_id = booking_api

    response = client.patch(
        f"/api/v1/venue-bookings/{booking_id}",
        headers=_auth("bob-token"),
        json={"action": "decline", "message": "No table is available."},
    )

    assert response.status_code == 200, response.text
    assert response.json()["status"] == "declined"
    event = client.get(f"/api/v1/events/{event_id}", headers=_auth("bob-token"))
    assert event.status_code == 200, event.text
    assert event.json()["status"] == "cancelled"


def test_venue_can_cancel_an_already_approved_booking(booking_api) -> None:
    client, _, event_id, booking_id = booking_api

    approved = client.patch(
        f"/api/v1/venue-bookings/{booking_id}",
        headers=_auth("bob-token"),
        json={"action": "approve"},
    )
    assert approved.status_code == 200, approved.text

    cancelled = client.patch(
        f"/api/v1/venue-bookings/{booking_id}",
        headers=_auth("bob-token"),
        json={"action": "cancel", "message": "Unexpected Venue closure."},
    )
    assert cancelled.status_code == 200, cancelled.text
    assert cancelled.json()["status"] == "cancelled"

    event = client.get(f"/api/v1/events/{event_id}", headers=_auth("bob-token"))
    assert event.status_code == 200, event.text
    assert event.json()["status"] == "cancelled"


def test_approval_rechecks_current_people_capacity(booking_api) -> None:
    client, factory, _, booking_id = booking_api

    with factory() as session:
        booking = session.get(VenueBookingRequest, booking_id)
        assert booking is not None
        window = session.get(VenueTableWindow, booking.venue_table_window_id)
        assert window is not None
        window.max_people_per_table = 1
        session.commit()

    response = client.patch(
        f"/api/v1/venue-bookings/{booking_id}",
        headers=_auth("bob-token"),
        json={"action": "approve"},
    )

    assert response.status_code == 409, response.text
    assert "capacity" in response.json()["detail"].lower()
