"""Deterministic geographic distance helpers for Table Match."""

from dataclasses import dataclass
from math import asin, cos, radians, sin, sqrt

EARTH_RADIUS_MILES = 3958.7613


@dataclass(frozen=True, slots=True)
class GeoPoint:
    """One private or public geographic coordinate used only for calculation."""

    latitude: float
    longitude: float

    def __post_init__(self) -> None:
        if not -90 <= self.latitude <= 90:
            raise ValueError("Latitude must be between -90 and 90 degrees.")
        if not -180 <= self.longitude <= 180:
            raise ValueError("Longitude must be between -180 and 180 degrees.")


def haversine_miles(origin: GeoPoint, destination: GeoPoint) -> float:
    """Return deterministic straight-line distance between two coordinates."""

    latitude_delta = radians(destination.latitude - origin.latitude)
    longitude_delta = radians(destination.longitude - origin.longitude)
    origin_latitude = radians(origin.latitude)
    destination_latitude = radians(destination.latitude)

    haversine = (
        sin(latitude_delta / 2) ** 2
        + cos(origin_latitude) * cos(destination_latitude) * sin(longitude_delta / 2) ** 2
    )
    central_angle = 2 * asin(sqrt(haversine))
    return EARTH_RADIUS_MILES * central_angle


def within_travel_radius(
    origin: GeoPoint,
    destination: GeoPoint,
    radius_miles: int | float,
) -> tuple[bool, float]:
    """Return travel eligibility and the unrounded approximate distance."""

    if radius_miles < 0:
        raise ValueError("Travel radius cannot be negative.")

    distance_miles = haversine_miles(origin, destination)
    return distance_miles <= float(radius_miles), distance_miles


__all__ = ["GeoPoint", "haversine_miles", "within_travel_radius"]
