"""Happy-path HTTP tests for authenticated Step 3 matching inputs."""

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


def test_player_can_create_and_list_only_own_demand(matching_context) -> None:
    client, _ = matching_context
    onboarding = client.put(
        "/api/v1/onboarding/player",
        json=player_payload(),
        headers=auth(),
    )
    assert onboarding.status_code == 200, onboarding.text

    created = client.post(
        "/api/v1/matching/player-demands",
        json=player_demand_payload(),
        headers=auth(),
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["system_slug"] == "dnd-5e-2014"
    assert body["status"] == "active"
    assert "player_profile_id" not in body and "user_id" not in body

    listed = client.get("/api/v1/matching/player-demands", headers=auth())
    assert listed.status_code == 200
    assert [item["id"] for item in listed.json()] == [body["id"]]


def test_gm_can_create_and_list_declared_system_supply(matching_context) -> None:
    client, _ = matching_context
    onboarding = client.put(
        "/api/v1/onboarding/gm",
        json=gm_payload(),
        headers=auth(),
    )
    assert onboarding.status_code == 200, onboarding.text

    created = client.post(
        "/api/v1/matching/gm-supplies",
        json=gm_supply_payload(),
        headers=auth(),
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["minimum_players"] == 3
    assert body["maximum_players"] == 5
    assert "gm_profile_id" not in body and "user_id" not in body

    listed = client.get("/api/v1/matching/gm-supplies", headers=auth())
    assert listed.status_code == 200
    assert [item["id"] for item in listed.json()] == [body["id"]]


def test_verified_venue_manager_can_create_and_list_table_window(matching_context) -> None:
    client, factory = matching_context
    venue_created = client.post(
        "/api/v1/onboarding/venue",
        json=venue_payload(),
        headers=auth(),
    )
    assert venue_created.status_code == 201, venue_created.text
    venue_id = UUID(venue_created.json()["venue_id"])

    with factory() as session:
        manager = session.scalar(select(VenueManager).where(VenueManager.venue_id == venue_id))
        assert manager is not None
        manager.verified_at = datetime.now(UTC)
        session.commit()

    created = client.post(
        f"/api/v1/matching/venues/{venue_id}/table-windows",
        json=venue_table_window_payload(),
        headers=auth(),
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["venue_id"] == str(venue_id)
    assert body["table_count"] == 2
    assert body["max_people_per_table"] == 6
    assert body["active"] is True
    assert "user_id" not in body

    listed = client.get(
        f"/api/v1/matching/venues/{venue_id}/table-windows",
        headers=auth(),
    )
    assert listed.status_code == 200
    assert [item["id"] for item in listed.json()] == [body["id"]]
