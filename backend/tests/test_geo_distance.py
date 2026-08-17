"""Tests for deterministic approximate geographic distance calculations."""

import pytest

from app.services.geo_distance import GeoPoint, haversine_miles, within_travel_radius


def test_same_coordinate_has_zero_distance() -> None:
    point = GeoPoint(latitude=34.0, longitude=-79.0)

    assert haversine_miles(point, point) == pytest.approx(0.0)


def test_one_degree_of_longitude_at_equator_is_about_sixty_nine_miles() -> None:
    origin = GeoPoint(latitude=0.0, longitude=0.0)
    destination = GeoPoint(latitude=0.0, longitude=1.0)

    assert haversine_miles(origin, destination) == pytest.approx(69.09, abs=0.05)


def test_travel_radius_returns_distance_and_eligibility() -> None:
    origin = GeoPoint(latitude=0.0, longitude=0.0)
    destination = GeoPoint(latitude=0.0, longitude=0.1)

    eligible, distance = within_travel_radius(origin, destination, 10)

    assert eligible is True
    assert distance == pytest.approx(6.91, abs=0.05)


def test_travel_radius_rejects_destination_outside_radius() -> None:
    origin = GeoPoint(latitude=0.0, longitude=0.0)
    destination = GeoPoint(latitude=0.0, longitude=1.0)

    eligible, distance = within_travel_radius(origin, destination, 25)

    assert eligible is False
    assert distance > 25


def test_invalid_coordinate_is_rejected() -> None:
    with pytest.raises(ValueError, match="Latitude"):
        GeoPoint(latitude=91.0, longitude=0.0)


def test_negative_travel_radius_is_rejected() -> None:
    point = GeoPoint(latitude=0.0, longitude=0.0)

    with pytest.raises(ValueError, match="Travel radius"):
        within_travel_radius(point, point, -1)
