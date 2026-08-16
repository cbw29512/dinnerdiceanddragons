"""Trust-boundary attacks for authenticated Step 3 matching inputs."""

from datetime import UTC, datetime
from uuid import UUID

import pytest
from gm_onboarding_test_data import gm_payload
from matching_signal_test_data import (
    gm_supply_payload,
    player_demand_payload,
    venue_table_window_payload,
)
from onboarding_test_support import build_onboarding_client
from player_onboarding_test_data import player_payload
from sqlalchemy import select
from venue_onboarding_test_data import venue_payload

from app.models.venue import VenueManager


@pytest.fixture()
def matching_context():
    client, factory, engine = build_onboarding_client()
    try:
        yield client, factory
    finally:
        client.close()
        engine.dispose()


def auth(token: str = "alice-token") -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_matching_inputs_require_authentication(matching_context) -> None:
    client, _ = matching_context
    response = client.post(
        "/api/v1/matching/player-demands",
        json=player_demand_payload(),
    )
    assert response.status_code == 401


def test_player_cannot_forge_profile_or_user_ownership(matching_context) -> None:
    client, _ = matching_context
    assert client.put(
        "/api/v1/onboarding/player",
        json=player_payload(),
        headers=auth(),
    ).status_code == 200

    payload = player_demand_payload()
    payload["player_profile_id"] = "00000000-0000-0000-0000-000000000999"
    payload["user_id"] = "00000000-0000-0000-0000-000000000998"
    response = client.post(
        "/api/v1/matching/player-demands",
        json=payload,
        headers=auth(),
    )
    assert response.status_code == 422
    assert "player_profile_id" in response.text
    assert "user_id" in response.text


def test_player_lists_do_not_cross_user_boundary(matching_context) -> None:
    client, _ = matching_context
    alice_payload = player_payload()
    bob_payload = player_payload()
    bob_payload["display_name"] = "Bob Adventurer"
    bob_payload["postal_code"] = "29505"

    assert client.put(
        "/api/v1/onboarding/player", json=alice_payload, headers=auth("alice-token")
    ).status_code == 200
    assert client.put(
        "/api/v1/onboarding/player", json=bob_payload, headers=auth("bob-token")
    ).status_code == 200

    alice_demand = client.post(
        "/api/v1/matching/player-demands",
        json=player_demand_payload(),
        headers=auth("alice-token"),
    )
    bob_demand = client.post(
        "/api/v1/matching/player-demands",
        json=player_demand_payload(),
        headers=auth("bob-token"),
    )
    assert alice_demand.status_code == 201
    assert bob_demand.status_code == 201

    alice_list = client.get(
        "/api/v1/matching/player-demands", headers=auth("alice-token")
    ).json()
    bob_list = client.get(
        "/api/v1/matching/player-demands", headers=auth("bob-token")
    ).json()
    assert [item["id"] for item in alice_list] == [alice_demand.json()["id"]]
    assert [item["id"] for item in bob_list] == [bob_demand.json()["id"]]


def test_gm_cannot_offer_system_missing_from_capability_profile(matching_context) -> None:
    client, _ = matching_context
    assert client.put(
        "/api/v1/onboarding/gm",
        json=gm_payload(),
        headers=auth(),
    ).status_code == 200

    payload = gm_supply_payload()
    payload["system_slug"] = "pathfinder-2e"
    response = client.post(
        "/api/v1/matching/gm-supplies",
        json=payload,
        headers=auth(),
    )
    assert response.status_code == 422
    assert "GM profile" in response.text


def test_gm_impossible_player_range_is_rejected_before_database(matching_context) -> None:
    client, _ = matching_context
    assert client.put(
        "/api/v1/onboarding/gm",
        json=gm_payload(),
        headers=auth(),
    ).status_code == 200

    payload = gm_supply_payload()
    payload["minimum_players"] = 6
    payload["maximum_players"] = 3
    response = client.post(
        "/api/v1/matching/gm-supplies",
        json=payload,
        headers=auth(),
    )
    assert response.status_code == 422
    assert "maximum_players" in response.text


def test_unverified_venue_manager_cannot_create_table_window(matching_context) -> None:
    client, _ = matching_context
    venue_created = client.post(
        "/api/v1/onboarding/venue",
        json=venue_payload(),
        headers=auth(),
    )
    assert venue_created.status_code == 201
    venue_id = venue_created.json()["venue_id"]

    response = client.post(
        f"/api/v1/matching/venues/{venue_id}/table-windows",
        json=venue_table_window_payload(),
        headers=auth(),
    )
    assert response.status_code == 403
    assert "not verified" in response.text


def test_venue_manager_cannot_operate_another_managers_venue(matching_context) -> None:
    client, factory = matching_context
    alice_venue = client.post(
        "/api/v1/onboarding/venue",
        json=venue_payload(),
        headers=auth("alice-token"),
    )
    assert alice_venue.status_code == 201
    alice_venue_id = UUID(alice_venue.json()["venue_id"])

    bob_venue_payload = venue_payload()
    bob_venue_payload["name"] = "Bob's Table Cafe"
    bob_venue_payload["address_line1"] = "456 Other Way"
    bob_venue = client.post(
        "/api/v1/onboarding/venue",
        json=bob_venue_payload,
        headers=auth("bob-token"),
    )
    assert bob_venue.status_code == 201

    with factory() as session:
        alice_manager = session.scalar(
            select(VenueManager).where(VenueManager.venue_id == alice_venue_id)
        )
        assert alice_manager is not None
        alice_manager.verified_at = datetime.now(UTC)
        session.commit()

    response = client.post(
        f"/api/v1/matching/venues/{alice_venue_id}/table-windows",
        json=venue_table_window_payload(),
        headers=auth("bob-token"),
    )
    assert response.status_code == 403


def test_venue_window_body_cannot_override_path_venue(matching_context) -> None:
    client, factory = matching_context
    venue_created = client.post(
        "/api/v1/onboarding/venue",
        json=venue_payload(),
        headers=auth(),
    )
    assert venue_created.status_code == 201
    venue_id = UUID(venue_created.json()["venue_id"])

    with factory() as session:
        manager = session.scalar(
            select(VenueManager).where(VenueManager.venue_id == venue_id)
        )
        assert manager is not None
        manager.verified_at = datetime.now(UTC)
        session.commit()

    payload = venue_table_window_payload()
    payload["venue_id"] = "00000000-0000-0000-0000-000000000999"
    response = client.post(
        f"/api/v1/matching/venues/{venue_id}/table-windows",
        json=payload,
        headers=auth(),
    )
    assert response.status_code == 422
    assert "venue_id" in response.text
