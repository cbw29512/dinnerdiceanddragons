"""Detached candidate snapshots used by the production Table Match engine."""

from dataclasses import dataclass
from uuid import UUID

from app.models.recurring_availability_rule import RecurringAvailabilityRule


@dataclass(frozen=True, slots=True)
class GMCandidate:
    """One active GM supply signal paired with one active availability rule."""

    signal_id: UUID
    game_system_id: UUID
    preferred_format: str
    minimum_players: int
    maximum_players: int
    status: str
    postal_code: str
    travel_radius_miles: int
    rule: RecurringAvailabilityRule


@dataclass(frozen=True, slots=True)
class VenueCandidate:
    """One active Venue table window with trusted public coordinates."""

    window_id: UUID
    venue_id: UUID
    table_count: int
    max_people_per_table: int
    active: bool
    verified: bool
    latitude: float
    longitude: float
    rule: RecurringAvailabilityRule


@dataclass(frozen=True, slots=True)
class PlayerCandidate:
    """One active Player demand signal paired with one availability rule."""

    demand_id: UUID
    game_system_id: UUID
    preferred_format: str
    status: str
    postal_code: str
    travel_radius_miles: int
    rule: RecurringAvailabilityRule


@dataclass(frozen=True, slots=True)
class MatchCandidateSnapshot:
    """All candidate inputs loaded without holding an open DB transaction."""

    gms: tuple[GMCandidate, ...]
    venues: tuple[VenueCandidate, ...]
    players: tuple[PlayerCandidate, ...]


__all__ = [
    "GMCandidate",
    "MatchCandidateSnapshot",
    "PlayerCandidate",
    "VenueCandidate",
]
