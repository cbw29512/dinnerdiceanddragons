"""Multi-role identity tests for Venue onboarding."""

import pytest
from gm_onboarding_test_data import gm_payload
from onboarding_test_support import ALICE_SUBJECT, build_onboarding_client
from player_onboarding_test_data import player_payload
from sqlalchemy import select
from venue_onboarding_test_data import venue_payload

from app.models.gm_profile import GMProfile
from app.models.player_profile import PlayerProfile
from app.models.user import User
from app.models.user_role import UserRole
from app.models.venue import VenueManager


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


def test_venue_onboarding_preserves_player_and_gm_roles(onboarding_context) -> None:
    client, factory = onboarding_context
    player_response = client.put(
        "/api/v1/onboarding/player",
        json=player_payload(),
        headers=auth(),
    )
    assert player_response.status_code == 200, player_response.text

    gm_response = client.put(
        "/api/v1/onboarding/gm",
        json=gm_payload(),
        headers=auth(),
    )
    assert gm_response.status_code == 200, gm_response.text

    venue_response = client.post(
        "/api/v1/onboarding/venue",
        json=venue_payload(),
        headers=auth(),
    )
    assert venue_response.status_code == 201, venue_response.text

    with factory() as session:
        user = session.scalar(select(User).where(User.auth_provider_user_id == ALICE_SUBJECT))
        assert user is not None
        roles = set(session.scalars(select(UserRole.role).where(UserRole.user_id == user.id)).all())
        player_profile = session.scalar(
            select(PlayerProfile).where(PlayerProfile.user_id == user.id)
        )
        gm_profile = session.scalar(select(GMProfile).where(GMProfile.user_id == user.id))
        relationship = session.scalar(select(VenueManager).where(VenueManager.user_id == user.id))

        assert roles == {"player", "gm", "venue_manager"}
        assert player_profile is not None
        assert gm_profile is not None
        assert relationship is not None
        assert relationship.verified_at is None
