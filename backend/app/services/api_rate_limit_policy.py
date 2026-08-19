"""Version-controlled distributed abuse-control policies for sensitive API writes."""

from dataclasses import dataclass
from enum import StrEnum


class RateLimitScope(StrEnum):
    HUB_MESSAGE = "hub_message"
    EVENT_REGISTRATION = "event_registration"
    TABLE_FORMATION = "table_formation"
    VENUE_BOOKING = "venue_booking"
    MATCHING_RUN = "matching_run"
    MATCHING_REFRESH = "matching_refresh"
    ONBOARDING_MUTATION = "onboarding_mutation"
    MATCHING_INPUT = "matching_input"
    PROVIDER_GEOCODING = "provider_geocoding"


@dataclass(frozen=True, slots=True)
class RateLimitPolicy:
    """Token-bucket capacity and steady refill rate for one abuse-control scope."""

    scope: RateLimitScope
    capacity: int
    refill_tokens: int
    refill_seconds: int

    @property
    def refill_rate_per_second(self) -> float:
        return self.refill_tokens / self.refill_seconds


POLICIES: dict[RateLimitScope, RateLimitPolicy] = {
    # Human conversation can burst briefly, while sustained automated spam is throttled.
    RateLimitScope.HUB_MESSAGE: RateLimitPolicy(
        scope=RateLimitScope.HUB_MESSAGE,
        capacity=12,
        refill_tokens=1,
        refill_seconds=3,
    ),
    # Seat/registration transitions should never need high-frequency retries.
    RateLimitScope.EVENT_REGISTRATION: RateLimitPolicy(
        scope=RateLimitScope.EVENT_REGISTRATION,
        capacity=8,
        refill_tokens=1,
        refill_seconds=8,
    ),
    # Formation is a comparatively expensive state transition with a very small legitimate burst.
    RateLimitScope.TABLE_FORMATION: RateLimitPolicy(
        scope=RateLimitScope.TABLE_FORMATION,
        capacity=3,
        refill_tokens=1,
        refill_seconds=60,
    ),
    # Venue staff may answer several bookings quickly, but not at automation-scale rates.
    RateLimitScope.VENUE_BOOKING: RateLimitPolicy(
        scope=RateLimitScope.VENUE_BOOKING,
        capacity=6,
        refill_tokens=1,
        refill_seconds=10,
    ),
    # Global matching remains the most restricted admin/internal execution path.
    RateLimitScope.MATCHING_RUN: RateLimitPolicy(
        scope=RateLimitScope.MATCHING_RUN,
        capacity=2,
        refill_tokens=1,
        refill_seconds=300,
    ),
    # A human may deliberately ask "find my table" after changing a signal. The
    # candidate budget still caps the global scan, while this prevents refresh spam.
    RateLimitScope.MATCHING_REFRESH: RateLimitPolicy(
        scope=RateLimitScope.MATCHING_REFRESH,
        capacity=3,
        refill_tokens=1,
        refill_seconds=60,
    ),
    # Profile/onboarding writes replace substantial user-owned state and should be deliberate.
    RateLimitScope.ONBOARDING_MUTATION: RateLimitPolicy(
        scope=RateLimitScope.ONBOARDING_MUTATION,
        capacity=6,
        refill_tokens=1,
        refill_seconds=20,
    ),
    # Demand/supply/window creation may legitimately happen in small setup bursts.
    RateLimitScope.MATCHING_INPUT: RateLimitPolicy(
        scope=RateLimitScope.MATCHING_INPUT,
        capacity=10,
        refill_tokens=1,
        refill_seconds=10,
    ),
    # Provider-backed geocoding is externally metered and only needed for deliberate admin review.
    RateLimitScope.PROVIDER_GEOCODING: RateLimitPolicy(
        scope=RateLimitScope.PROVIDER_GEOCODING,
        capacity=2,
        refill_tokens=1,
        refill_seconds=60,
    ),
}


def policy_for(scope: RateLimitScope) -> RateLimitPolicy:
    return POLICIES[scope]


__all__ = ["POLICIES", "RateLimitPolicy", "RateLimitScope", "policy_for"]
