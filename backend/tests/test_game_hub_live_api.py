"""End-to-end API privacy and authorization tests for the live Game Hub."""

from datetime import UTC, datetime

import pytest
from game_hub_live_test_support import LiveHubSeed, auth, build_hub_client
from sqlalchemy import select

from app.api.routes.events import router as events_router
from app.api.routes.game_hub import index_router
from app.api.routes.game_hub import router as game_hub_router
from app.models.event import Event, EventStatus
from app.models.message import Message


@pytest.fixture()
def hub_api():
    client, factory, engine, seed = build_hub_client((index_router, game_hub_router, events_router))
    try:
        yield client, factory, seed
    finally:
        client.close()
        engine.dispose()


def test_my_game_hubs_index_lists_only_live_participation(hub_api) -> None:
    client, _, seed = hub_api
    for token in ("alice-token", "bob-token", "carol-token", "dave-token"):
        response = client.get("/api/v1/game-hubs", headers=auth(token))
        assert response.status_code == 200, response.text
        assert [item["event_id"] for item in response.json()] == [str(seed.event_id)]
        _assert_no_private_fields(response.json())


def test_role_capabilities_and_safe_gm_queue(hub_api) -> None:
    client, _, seed = hub_api
    player = client.get(f"/api/v1/events/{seed.event_id}/hub", headers=auth("alice-token"))
    assert player.status_code == 200, player.text
    assert player.json()["capabilities"]["viewer_roles"] == ["player"]
    assert player.json()["registration_queue"] == []

    gm = client.get(f"/api/v1/events/{seed.event_id}/hub", headers=auth("bob-token"))
    assert gm.status_code == 200, gm.text
    assert gm.json()["capabilities"]["viewer_roles"] == ["gm"]
    assert {item["display_name"] for item in gm.json()["registration_queue"]} == {
        "Alice",
        "Dave",
    }

    venue = client.get(f"/api/v1/events/{seed.event_id}/hub", headers=auth("carol-token"))
    assert venue.status_code == 200, venue.text
    assert venue.json()["capabilities"]["viewer_roles"] == ["venue_manager"]
    assert venue.json()["registration_queue"] == []
    for payload in (player.json(), gm.json(), venue.json()):
        _assert_no_private_fields(payload)


def test_cancelled_player_loses_hub_access_and_index_entry(hub_api) -> None:
    client, _, seed = hub_api
    cancelled = client.patch(
        f"/api/v1/events/{seed.event_id}/registrations/me",
        headers=auth("dave-token"),
        json={"action": "cancel"},
    )
    assert cancelled.status_code == 200, cancelled.text
    response = client.get(f"/api/v1/events/{seed.event_id}/hub", headers=auth("dave-token"))
    assert response.status_code == 404
    assert client.get("/api/v1/game-hubs", headers=auth("dave-token")).json() == []


def test_cancelled_event_is_archived_from_index_and_read_only(hub_api) -> None:
    client, factory, seed = hub_api
    with factory() as session:
        event = session.get(Event, seed.event_id)
        assert event is not None
        event.status = EventStatus.CANCELLED.value
        session.commit()

    index = client.get("/api/v1/game-hubs", headers=auth("bob-token"))
    assert index.status_code == 200
    assert index.json() == []

    archived = client.get(f"/api/v1/events/{seed.event_id}/hub", headers=auth("bob-token"))
    assert archived.status_code == 200, archived.text
    assert archived.json()["event"]["status"] == EventStatus.CANCELLED.value

    write = _post_raw(
        client,
        seed,
        "bob-token",
        {"channel_type": "table_announcement", "body": "Should not persist."},
    )
    assert write.status_code == 409


def test_private_player_messages_are_isolated_from_other_players_and_venue(hub_api) -> None:
    client, _, seed = hub_api
    _post(client, seed, "bob-token", "table_announcement", "Doors open at 5:45.")
    _post(client, seed, "bob-token", "gm_venue", "Venue-only operations note.")
    _post(client, seed, "alice-token", "table_discussion", "I can bring dice.")
    _post(client, seed, "alice-token", "player_gm", "Alice private GM question.")
    _post(client, seed, "dave-token", "player_gm", "Dave private GM question.")
    _post(
        client,
        seed,
        "alice-token",
        "player_venue_question",
        "Is the entrance step-free?",
        category="accessibility",
    )
    _post(
        client,
        seed,
        "carol-token",
        "player_venue_question",
        "Yes, use the side entrance.",
        category="accessibility",
        registration_id=str(seed.alice_registration_id),
    )

    alice_page = _messages(client, seed, "alice-token")
    dave_page = _messages(client, seed, "dave-token")
    venue_page = _messages(client, seed, "carol-token")
    gm_page = _messages(client, seed, "bob-token")
    alice = {item["body"] for item in alice_page["items"]}
    dave = {item["body"] for item in dave_page["items"]}
    venue = {item["body"] for item in venue_page["items"]}
    gm = {item["body"] for item in gm_page["items"]}

    assert "Alice private GM question." in alice
    assert "Dave private GM question." not in alice
    assert "Dave private GM question." in dave
    assert "Alice private GM question." not in dave
    assert "Venue-only operations note." not in alice
    assert "Venue-only operations note." in venue
    assert "I can bring dice." not in venue
    assert "Alice private GM question." not in venue
    assert "Is the entrance step-free?" in venue
    assert "Yes, use the side entrance." in alice
    assert "Alice private GM question." in gm
    assert all(item["reply_registration_id"] is None for item in alice_page["items"])
    assert all(item["reply_registration_id"] is None for item in dave_page["items"])
    question = next(
        item for item in venue_page["items"] if item["body"] == "Is the entrance step-free?"
    )
    assert question["reply_registration_id"] == str(seed.alice_registration_id)


def test_player_cannot_post_announcement_bad_cursor_is_422_and_pages_do_not_repeat(hub_api) -> None:
    client, factory, seed = hub_api
    denied = _post_raw(
        client,
        seed,
        "alice-token",
        {"channel_type": "table_announcement", "body": "Nope."},
    )
    assert denied.status_code == 403
    cursor = client.get(
        f"/api/v1/events/{seed.event_id}/messages?cursor=not-a-cursor",
        headers=auth("alice-token"),
    )
    assert cursor.status_code == 422

    for body in ("One", "Two", "Three"):
        _post(client, seed, "bob-token", "table_announcement", body)

    # SQLite stores CURRENT_TIMESTAMP differently from a bound DateTime value.
    # Normalize the fixture so this test exercises the UUID tie-break for equal
    # timestamps, matching PostgreSQL timestamptz keyset semantics.
    with factory() as session:
        rows = session.scalars(
            select(Message).where(
                Message.event_id == seed.event_id,
                Message.channel_type == "table_announcement",
                Message.body.in_(("One", "Two", "Three")),
            )
        ).all()
        assert len(rows) == 3
        stable_time = datetime(2030, 8, 1, 14, tzinfo=UTC)
        for row in rows:
            row.created_at = stable_time
        session.commit()

    first = client.get(
        f"/api/v1/events/{seed.event_id}/messages?limit=2",
        headers=auth("alice-token"),
    ).json()
    assert len(first["items"]) == 2 and first["next_cursor"]
    second = client.get(
        f"/api/v1/events/{seed.event_id}/messages?limit=2&cursor={first['next_cursor']}",
        headers=auth("alice-token"),
    ).json()
    first_ids = {item["id"] for item in first["items"]}
    second_ids = {item["id"] for item in second["items"]}
    assert first_ids.isdisjoint(second_ids)


def _post(
    client,
    seed: LiveHubSeed,
    token: str,
    channel: str,
    body: str,
    *,
    category: str | None = None,
    registration_id: str | None = None,
) -> dict:
    payload = {"channel_type": channel, "body": body}
    if category is not None:
        payload["category"] = category
    if registration_id is not None:
        payload["registration_id"] = registration_id
    response = _post_raw(client, seed, token, payload)
    assert response.status_code == 200, response.text
    _assert_no_private_fields(response.json())
    return response.json()


def _post_raw(client, seed: LiveHubSeed, token: str, payload: dict):
    return client.post(
        f"/api/v1/events/{seed.event_id}/messages", headers=auth(token), json=payload
    )


def _messages(client, seed: LiveHubSeed, token: str) -> dict:
    response = client.get(f"/api/v1/events/{seed.event_id}/messages", headers=auth(token))
    assert response.status_code == 200, response.text
    _assert_no_private_fields(response.json())
    return response.json()


def _assert_no_private_fields(payload: object) -> None:
    serialized = str(payload).lower()
    for forbidden in (
        "email",
        "postal_code",
        "latitude",
        "longitude",
        "player_profile_id",
        "gm_profile_id",
        "sender_user_id",
        "recipient_user_id",
        "address_line1",
        "accessibility_notes_private",
    ):
        assert forbidden not in serialized
