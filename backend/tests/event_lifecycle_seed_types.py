"""Typed result shared by Event lifecycle test fixtures."""

from dataclasses import dataclass

from app.models.player_demand_signal import PlayerDemandSignal
from app.models.player_profile import PlayerProfile
from app.models.user import User


@dataclass(frozen=True, slots=True)
class LifecycleSeed:
    event_id: object
    booking_id: object
    match_id: object
    gm_user: User
    player_users: tuple[User, ...]
    player_profiles: tuple[PlayerProfile, ...]
    player_demands: tuple[PlayerDemandSignal, ...]


__all__ = ["LifecycleSeed"]
