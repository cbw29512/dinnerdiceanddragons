"""HTTP error, authorization, and validation contract tests for table formation."""

from uuid import uuid4

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


def test_form_requires_authentication_and_owning_gm_role(api_context) -> None:
    client, match_id = api_context

    unauthenticated = client.post(
        f"/api/v1/matching/opportunities/{match_id}/form",
        json={"title": "No Auth"},
    )
    wrong_role = client.post(
        f"/api/v1/matching/opportunities/{match_id}/form",
        headers=_auth("alice-token"),
        json={"title": "Wrong Role"},
    )

    assert unauthenticated.status_code == 401
    assert wrong_role.status_code == 403


def test_registration_requires_literal_expectations_acknowledgement(api_context) -> None:
    client, match_id = api_context
    formed = _form(client, match_id)

    response = client.post(
        f"/api/v1/events/{formed['event_id']}/registrations",
        headers=_auth("alice-token"),
        json={"expectations_acknowledged": False},
    )

    assert response.status_code == 422


def test_player_cannot_read_gm_registration_queue_or_manage_venue_booking(api_context) -> None:
    client, match_id = api_context
    formed = _form(client, match_id)

    queue = client.get(
        f"/api/v1/events/{formed['event_id']}/registrations",
        headers=_auth("alice-token"),
    )
    booking = client.patch(
        f"/api/v1/venue-bookings/{formed['venue_booking_request_id']}",
        headers=_auth("alice-token"),
        json={"status": "approved"},
    )

    assert queue.status_code == 404
    assert booking.status_code == 403


def test_inaccessible_event_and_unknown_booking_do_not_leak_state(api_context) -> None:
    client, _ = api_context

    event_response = client.get(
        f"/api/v1/events/{uuid4()}",
        headers=_auth("alice-token"),
    )
    booking_response = client.patch(
        f"/api/v1/venue-bookings/{uuid4()}",
        headers=_auth("bob-token"),
        json={"status": "approved"},
    )

    assert event_response.status_code == 404
    assert event_response.json() == {"detail": "Resource not found."}
    assert booking_response.status_code == 404
    assert booking_response.json() == {"detail": "Resource not found."}


def test_invalid_registration_and_booking_actions_fail_validation(api_context) -> None:
    client, match_id = api_context
    formed = _form(client, match_id)

    invalid_registration = client.patch(
        f"/api/v1/events/{formed['event_id']}/registrations/{uuid4()}",
        headers=_auth("bob-token"),
        json={"status": "anything"},
    )
    invalid_booking = client.patch(
        f"/api/v1/venue-bookings/{formed['venue_booking_request_id']}",
        headers=_auth("bob-token"),
        json={"status": "anything"},
    )

    assert invalid_registration.status_code == 422
    assert invalid_booking.status_code == 422


def _form(client, match_id):
    response = client.post(
        f"/api/v1/matching/opportunities/{match_id}/form",
        headers=_auth("bob-token"),
        json={"title": "Formation Error Test"},
    )
    assert response.status_code == 200, response.text
    return response.json()
