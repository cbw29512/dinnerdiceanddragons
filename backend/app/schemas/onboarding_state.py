"""Authenticated onboarding readback response schemas."""

from app.schemas.gm_onboarding import GMOnboardingRequest
from app.schemas.player_onboarding import PlayerOnboardingRequest


class PlayerOnboardingState(PlayerOnboardingRequest):
    """Canonical Player onboarding state safe to return to its owner."""


class GMOnboardingState(GMOnboardingRequest):
    """Canonical GM onboarding state safe to return to its owner."""
