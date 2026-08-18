"""Version-controlled distributed abuse-control policies for sensitive API writes."""

from dataclasses import dataclass
from enum import StrEnum


class RateLimitScope(StrEnum):
    ONBOARDING = "onboarding"
    MATCHING_INPUT = "matching_input"
    HUB_MESSAGE = "hub_message"
    EVENT_REGISTRATION = "event_registration"
    TABLE_FORMATION = "table_formation"
    VENUE_BOOKING = "venue_booking"
    VENUE_VERIFICATION = "venue_verification"
    MATCHING_RUN = "matching_run"


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
    # Profile/role onboarding is user-driven and should not be automated at high frequency.
    RateLimitScope.ONBOARDING: RateLimitPolicy(
        scope=RateLimitScope.ONBOARDING,
        capacity=6,
        refill_tokens=1,
        refill_seconds=30,
    ),
    # Demand/supply/window creation can happen in short bursts but should not become feed spam.
    RateLimitScope.MATCHING_INPUT: RateLimitPolicy(
        scope=RateLimitScope.MATCHING_INPUT,
        capacity=12,
        refill_tokens=1,
        refill_seconds=10,
    ),
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
    # Verification consumes an external geocoding request and is intentionally very tight.
    RateLimitScope.VENUE_VERIFICATION: RateLimitPolicy(
        scope=RateLimitScope.VENUE_VERIFICATION,
        capacity=2,
        refill_tokens=1,
        refill_seconds=300,
    ),
    # Global matching is admin/internal and materially more expensive than ordinary writes.
    RateLimitScope.MATCHING_RUN: RateLimitPolicy(
        scope=RateLimitScope.MATCHING_RUN,
        capacity=2,
        refill_tokens=1,
        refill_seconds=300,
    ),
}


def policy_for(scope: RateLimitScope) -> RateLimitPolicy:
    return POLICIES[scope]


__all__ = ["POLICIES", "RateLimitPolicy", "RateLimitScope", "policy_for"]
