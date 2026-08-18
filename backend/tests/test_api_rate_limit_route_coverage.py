"""Coverage contracts for sensitive write routes added after the limiter foundation."""

from types import SimpleNamespace
from unittest.mock import Mock
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.api.routes import matching_inputs, onboarding, venue_onboarding, venue_verification
from app.services.api_rate_limit_policy import POLICIES, RateLimitScope


def test_every_declared_rate_limit_scope_has_a_policy() -> None:
    assert set(POLICIES) == set(RateLimitScope)
    for policy in POLICIES.values():
        assert policy.capacity >= 1
        assert policy.refill_tokens >= 1
        assert policy.refill_seconds >= 1


@pytest.mark.parametrize(
    ("route", "service_name", "result"),
    [
        (
            onboarding.put_player_onboarding,
            "save_player_onboarding",
            SimpleNamespace(
                player_profile_id=uuid4(),
                display_name="Player",
                system_slugs=("dnd-5e",),
                availability_count=1,
            ),
        ),
        (
            onboarding.put_gm_onboarding,
            "save_gm_onboarding",
            SimpleNamespace(
                gm_profile_id=uuid4(),
                display_name="GM",
                system_slugs=("dnd-5e",),
                availability_count=1,
            ),
        ),
    ],
)
def test_player_and_gm_onboarding_consume_onboarding_scope(
    monkeypatch: pytest.MonkeyPatch,
    route,
    service_name: str,
    result: SimpleNamespace,
) -> None:
    limiter = Mock(return_value=5)
    monkeypatch.setattr(onboarding, "enforce_user_rate_limit", limiter)
    monkeypatch.setattr(onboarding, service_name, Mock(return_value=result))
    user, session = Mock(), Mock()

    route(object(), user, session)

    limiter.assert_called_once_with(session, user, RateLimitScope.ONBOARDING)


def test_venue_onboarding_consumes_onboarding_scope(monkeypatch: pytest.MonkeyPatch) -> None:
    limiter = Mock(return_value=5)
    monkeypatch.setattr(venue_onboarding, "enforce_user_rate_limit", limiter)
    monkeypatch.setattr(
        venue_onboarding,
        "save_venue_onboarding",
        Mock(
            return_value=SimpleNamespace(
                venue_id=uuid4(),
                venue_manager_id=uuid4(),
                name="Venue",
                slug="venue",
                role="venue_manager",
            )
        ),
    )
    user, session = Mock(), Mock()

    venue_onboarding.post_venue_onboarding(object(), user, session)

    limiter.assert_called_once_with(session, user, RateLimitScope.ONBOARDING)


@pytest.mark.parametrize(
    ("route", "service_name", "args"),
    [
        (matching_inputs.post_player_demand, "create_player_demand", (object(),)),
        (matching_inputs.post_gm_supply, "create_gm_supply", (object(),)),
        (
            matching_inputs.post_venue_table_window,
            "create_venue_table_window",
            (uuid4(), object()),
        ),
    ],
)
def test_matching_input_creates_consume_matching_scope(
    monkeypatch: pytest.MonkeyPatch,
    route,
    service_name: str,
    args: tuple[object, ...],
) -> None:
    limiter = Mock(return_value=11)
    monkeypatch.setattr(matching_inputs, "enforce_user_rate_limit", limiter)
    monkeypatch.setattr(matching_inputs, service_name, Mock(return_value=object()))
    user, session = Mock(), Mock()

    route(*args, user, session)

    limiter.assert_called_once_with(session, user, RateLimitScope.MATCHING_INPUT)


def test_venue_verification_blocks_before_external_geocoding(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def blocked(*_args, **_kwargs) -> None:
        raise HTTPException(status_code=429, detail="Too many requests.")

    monkeypatch.setattr(venue_verification, "enforce_user_rate_limit", blocked)
    geocoder = Mock()

    with pytest.raises(HTTPException) as exc_info:
        venue_verification.post_venue_verification(
            uuid4(),
            uuid4(),
            Mock(),
            Mock(),
            geocoder,
        )

    assert exc_info.value.status_code == 429
    geocoder.geocode.assert_not_called()
