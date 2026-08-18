"""Per-run caches for recurrence and approximate-distance computation."""

from datetime import date
from uuid import UUID

from app.models.recurring_availability_rule import RecurringAvailabilityRule
from app.services.geo_distance import GeoPoint, haversine_miles
from app.services.postal_centroids import PostalCentroidResolver, normalize_us_postal_code
from app.services.recurrence_expansion import OccurrenceWindow, expand_occurrences


class TableMatchComputationContext:
    """Avoid repeated provider, recurrence, and distance work within one match run."""

    def __init__(self, postal_resolver: PostalCentroidResolver) -> None:
        self._postal_resolver = postal_resolver
        self._points: dict[str, GeoPoint] = {}
        self._occurrences: dict[tuple[UUID, date, date], tuple[OccurrenceWindow, ...]] = {}
        self._distances: dict[tuple[str, UUID], float] = {}

    def postal_point(self, postal_code: str) -> GeoPoint:
        normalized = normalize_us_postal_code(postal_code)
        cached = self._points.get(normalized)
        if cached is not None:
            return cached

        point = self._postal_resolver.resolve(normalized).point
        self._points[normalized] = point
        return point

    def occurrences(
        self,
        rule: RecurringAvailabilityRule,
        window_start: date,
        window_end: date,
    ) -> tuple[OccurrenceWindow, ...]:
        key = (rule.id, window_start, window_end)
        cached = self._occurrences.get(key)
        if cached is not None:
            return cached

        expanded = tuple(expand_occurrences(rule, window_start, window_end))
        self._occurrences[key] = expanded
        return expanded

    def distance_to_venue(
        self,
        postal_code: str,
        venue_id: UUID,
        venue_point: GeoPoint,
    ) -> float:
        normalized = normalize_us_postal_code(postal_code)
        key = (normalized, venue_id)
        cached = self._distances.get(key)
        if cached is not None:
            return cached

        distance = haversine_miles(self.postal_point(normalized), venue_point)
        self._distances[key] = distance
        return distance


__all__ = ["TableMatchComputationContext"]
