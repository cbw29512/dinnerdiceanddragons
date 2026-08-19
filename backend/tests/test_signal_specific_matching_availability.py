"""Regression tests for what/when pairing on concrete matching signals."""

from gm_onboarding_test_data import gm_payload
from matching_signal_test_data import gm_supply_payload, player_demand_payload
from onboarding_test_support import build_onboarding_client
from player_onboarding_test_data import player_payload

from app.services.table_match_gm_candidates import load_gm_candidates
from app.services.table_match_player_candidates import load_player_candidates


def _auth() -> dict[str, str]:
    return {"Authorization": "Bearer alice-token"}


def test_gm_supply_uses_signal_specific_day_instead_of_profile_default() -> None:
    client, factory, engine = build_onboarding_client()
    try:
        onboarded = client.put(
            "/api/v1/onboarding/gm",
            json=gm_payload(),
            headers=_auth(),
        )
        assert onboarded.status_code == 200, onboarded.text
        assert gm_payload()["availability"][0]["day_of_week"] == "saturday"

        created = client.post(
            "/api/v1/matching/gm-supplies",
            json=gm_supply_payload(),
            headers=_auth(),
        )
        assert created.status_code == 201, created.text
        assert created.json()["availability"][0]["day_of_week"] == "friday"

        with factory() as session:
            candidates = load_gm_candidates(session)
        assert len(candidates) == 1
        assert candidates[0].rule.day_of_week == "friday"
    finally:
        client.close()
        engine.dispose()


def test_player_demand_uses_signal_specific_day_instead_of_profile_default() -> None:
    client, factory, engine = build_onboarding_client()
    try:
        onboarded = client.put(
            "/api/v1/onboarding/player",
            json=player_payload(),
            headers=_auth(),
        )
        assert onboarded.status_code == 200, onboarded.text
        assert player_payload()["availability"][0]["day_of_week"] == "saturday"

        created = client.post(
            "/api/v1/matching/player-demands",
            json=player_demand_payload(),
            headers=_auth(),
        )
        assert created.status_code == 201, created.text
        assert created.json()["availability"][0]["day_of_week"] == "friday"

        with factory() as session:
            candidates = load_player_candidates(session)
        assert len(candidates) == 1
        assert candidates[0].rule.day_of_week == "friday"
    finally:
        client.close()
        engine.dispose()
