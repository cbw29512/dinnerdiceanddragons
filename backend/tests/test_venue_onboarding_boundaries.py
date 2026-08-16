"""Trust and Step 2/Step 3 boundary tests for Venue onboarding."""

import pytest
from onboarding_test_support import build_onboarding_client
from sqlalchemy import select
from venue_onboarding_test_data import venue_payload

from app.models.venue import Venue, VenueManager


@pytest.fixture()
def onboarding_context():
    client, factory, engine = build_onboarding_client()
    try:
        yield client, factory
    finally:
        client.close()
        engine.dispose()


def auth() -> dict[str, str]:
    return {"Authorization": "Bearer alice-token"}


def test_client_cannot_self_verify_or_supply_venue_identity(onboarding_context) -> None:
    client, factory = onboarding_context
    payload = venue_payload()
    payload.update(
        {
            "venue_id": "00000000-0000-0000-0000-000000000999",
            "user_id": "00000000-0000-0000-0000-000000000998",
            "email": "forged@example.com",
            "slug": "forged-slug",
            "verified": True,
            "verified_at": "2026-08-16T00:00:00Z",
            "latitude": 34.2,
            "longitude": -79.7,
        }
    )

    response = client.post(
        "/api/v1/onboarding/venue",
        json=payload,
        headers=auth(),
    )
    assert response.status_code == 422
    for field in (
        "venue_id",
        "user_id",
        "email",
        "slug",
        "verified",
        "verified_at",
        "latitude",
        "longitude",
    ):
        assert field in response.text

    with factory() as session:
        assert session.scalar(select(Venue)) is None
        assert session.scalar(select(VenueManager)) is None


def test_step3_table_window_fields_are_rejected_by_step2_venue_onboarding(
    onboarding_context,
) -> None:
    client, factory = onboarding_context
    payload = venue_payload()
    payload.update(
        {
            "window_day": "Tuesday",
            "window_start": "18:00",
            "window_end": "22:00",
            "table_count": 1,
            "seats_per_table": 6,
            "purchase_policy": "One purchase per guest",
            "approval_required": True,
        }
    )

    response = client.post(
        "/api/v1/onboarding/venue",
        json=payload,
        headers=auth(),
    )
    assert response.status_code == 422
    assert "table_count" in response.text
    assert "approval_required" in response.text

    with factory() as session:
        assert session.scalar(select(Venue)) is None
