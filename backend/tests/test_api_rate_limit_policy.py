"""Policy inventory tests for version-controlled API abuse controls."""

from app.services.api_rate_limit_policy import POLICIES, RateLimitScope, policy_for


def test_every_declared_scope_has_one_valid_policy() -> None:
    assert set(POLICIES) == set(RateLimitScope)

    for scope in RateLimitScope:
        policy = policy_for(scope)
        assert policy.scope is scope
        assert policy.capacity >= 1
        assert policy.refill_tokens >= 1
        assert policy.refill_seconds >= 1
        assert policy.refill_rate_per_second > 0


def test_launch_blocking_mutation_classes_have_distinct_scopes() -> None:
    required = {
        RateLimitScope.HUB_MESSAGE,
        RateLimitScope.EVENT_REGISTRATION,
        RateLimitScope.TABLE_FORMATION,
        RateLimitScope.VENUE_BOOKING,
        RateLimitScope.MATCHING_RUN,
        RateLimitScope.ONBOARDING_MUTATION,
        RateLimitScope.MATCHING_INPUT,
        RateLimitScope.PROVIDER_GEOCODING,
    }

    assert required <= set(POLICIES)
