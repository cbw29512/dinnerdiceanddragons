"""HTTP tests for role-safe explainable Table Match opportunities."""

from datetime import date
from uuid import UUID, uuid4

import pytest
from onboarding_test_support import build_onboarding_client
from sqlalchemy.orm import Session
from table_match_api_test_support import seed_api_matches

from app.api.routes.table_match_opportunities import get_match_runner
from app.models.table_match import TableMatch, TableMatchStatus
from app.models.user_role import UserRole, UserRoleType
from app.services.table_match_persistence_service import PersistedMatchResult
from app.services.table_match_runner import TableMatchRunResult


@pytest.fixture()
def api_context():
    client, factory, engine = build_onboarding_client()
    try:
        for token in ("alice-token", "bob-token"):
            response = client.get("/api/v1/me", headers=_auth(token))
            assert response.status_code == 200, response.text
        shared_id, bob_only_id, alice_id, _ = seed_api_matches(factory)
        yield client, factory, shared_id, bob_only_id, alice_id
    finally:
        client.close()
        engine.dispose()


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_player_lists_only_matches_containing_own_demand(api_context) -> None:
    client, _, shared_id, bob_only_id, _ = api_context

    response = client.get("/api/v1/matching/opportunities", headers=_auth("alice-token"))

    assert response.status_code == 200, response.text
    body = response.json()
    assert [item["id"] for item in body] == [str(shared_id)]
    assert str(bob_only_id) not in {item["id"] for item in body}
    item = body[0]
    assert item["viewer_roles"] == ["player"]
    assert item["your_player_distance_miles"] == pytest.approx(5.25)
    assert item["your_gm_distance_miles"] is None
    _assert_no_private_location_fields(item)


def test_gm_and_verified_manager_receive_only_own_context(api_context) -> None:
    client, _, shared_id, bob_only_id, _ = api_context

    response = client.get("/api/v1/matching/opportunities", headers=_auth("bob-token"))

    assert response.status_code == 200, response.text
    body = response.json()
    assert {item["id"] for item in body} == {str(shared_id), str(bob_only_id)}
    for item in body:
        assert set(item["viewer_roles"]) == {"gm", "venue_manager"}
        assert item["your_gm_distance_miles"] == pytest.approx(7.5)
        assert item["your_player_distance_miles"] is None
        _assert_no_private_location_fields(item)


def test_inaccessible_opportunity_returns_non_leaking_404(api_context) -> None:
    client, _, _, bob_only_id, _ = api_context

    response = client.get(
        f"/api/v1/matching/opportunities/{bob_only_id}",
        headers=_auth("alice-token"),
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "Opportunity not found."}


def test_expired_match_is_not_returned_as_an_active_opportunity(api_context) -> None:
    client, factory, shared_id, _, _ = api_context
    with factory() as session:
        match = session.get(TableMatch, shared_id)
        assert match is not None
        match.status = TableMatchStatus.EXPIRED.value
        session.commit()

    listing = client.get(
        "/api/v1/matching/opportunities",
        headers=_auth("alice-token"),
    )
    detail = client.get(
        f"/api/v1/matching/opportunities/{shared_id}",
        headers=_auth("alice-token"),
    )

    assert listing.status_code == 200
    assert listing.json() == []
    assert detail.status_code == 404
    assert detail.json() == {"detail": "Opportunity not found."}


def test_player_detail_contains_explanation_and_only_own_match_facts(api_context) -> None:
    client, _, shared_id, _, _ = api_context

    response = client.get(
        f"/api/v1/matching/opportunities/{shared_id}",
        headers=_auth("alice-token"),
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["your_player_fit_flags"] == ["system", "schedule", "distance"]
    assert body["your_player_availability_overlap"]["start"].endswith("-04:00")
    assert body["explanations"][0]["criterion"] == "system"
    _assert_no_private_location_fields(body)


def test_find_my_table_runs_matcher_and_returns_caller_visible_boom(api_context) -> None:
    client, _, shared_id, _, _ = api_context

    def stub_runner(*, window_start: date, window_end: date) -> TableMatchRunResult:
        assert (window_end - window_start).days == 29
        return TableMatchRunResult(computed_opportunities=1, persisted=())

    client.app.dependency_overrides[get_match_runner] = lambda: stub_runner
    response = client.post(
        "/api/v1/matching/find-my-table",
        headers=_auth("alice-token"),
        json={"horizon_days": 30},
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["boom"] is True
    assert [item["id"] for item in body["opportunities"]] == [str(shared_id)]
    assert body["run"] == {
        "computed_opportunities": 1,
        "persisted_count": 0,
        "created_count": 0,
        "refreshed_count": 0,
        "materialized_table_count": 0,
        "expired_count": 0,
    }


def test_match_run_is_admin_only_and_returns_non_sensitive_counts(api_context) -> None:
    client, factory, _, _, alice_id = api_context

    denied = client.post(
        "/api/v1/matching/run",
        headers=_auth("alice-token"),
        json={"window_start": "2026-08-21", "window_end": "2026-08-31"},
    )
    assert denied.status_code == 403

    with factory() as session:
        _grant_admin(session, alice_id)

    def stub_runner(*, window_start: date, window_end: date) -> TableMatchRunResult:
        assert window_start == date(2026, 8, 21)
        assert window_end == date(2026, 8, 31)
        return TableMatchRunResult(
            computed_opportunities=2,
            persisted=(
                PersistedMatchResult(table_match_id=uuid4(), created=True, refreshed=True),
                PersistedMatchResult(table_match_id=uuid4(), created=False, refreshed=True),
            ),
            expired_count=1,
        )

    client.app.dependency_overrides[get_match_runner] = lambda: stub_runner
    response = client.post(
        "/api/v1/matching/run",
        headers=_auth("alice-token"),
        json={"window_start": "2026-08-21", "window_end": "2026-08-31"},
    )

    assert response.status_code == 200, response.text
    assert response.json() == {
        "computed_opportunities": 2,
        "persisted_count": 2,
        "created_count": 1,
        "refreshed_count": 2,
        "materialized_table_count": 0,
        "expired_count": 1,
    }


def _grant_admin(session: Session, user_id: UUID) -> None:
    session.add(UserRole(user_id=user_id, role=UserRoleType.ADMIN.value))
    session.commit()


def _assert_no_private_location_fields(payload: object) -> None:
    serialized = str(payload).lower()
    for forbidden in (
        "postal_code",
        "latitude",
        "longitude",
        "player_profile_id",
        "gm_profile_id",
        "user_id",
        "address_line1",
    ):
        assert forbidden not in serialized
