"""Geocodio ZIP-centroid adapter tests with no real network access."""

from typing import Any

import httpx
import pytest
from pydantic import SecretStr

from app.core.config import Settings
from app.services.geocoding import GeocodingProviderError
from app.services.geocodio_postal_resolver import (
    GEOCODIO_GEOCODE_URL,
    GeocodioPostalCentroidResolver,
)

API_KEY = "test-geocodio-key"
POSTAL_CODE = "29501"


def settings() -> Settings:
    return Settings(geocodio_api_key=SecretStr(API_KEY))


def centroid_payload(*, postal_code: str = POSTAL_CODE) -> dict[str, Any]:
    return {
        "results": [
            {
                "address_components": {"postal_code": postal_code},
                "location": {"lat": 34.1954, "lng": -79.7626},
                "accuracy": 1.0,
                "accuracy_type": "place",
            }
        ]
    }


def test_zip_centroid_maps_to_provider_neutral_result() -> None:
    captured: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        captured.append(request)
        return httpx.Response(200, request=request, json=centroid_payload())

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        result = GeocodioPostalCentroidResolver(
            settings=settings(),
            client=client,
        ).resolve(POSTAL_CODE)

    assert result.postal_code == POSTAL_CODE
    assert result.latitude == pytest.approx(34.1954)
    assert result.longitude == pytest.approx(-79.7626)
    assert result.accuracy == pytest.approx(1.0)
    assert result.accuracy_type == "place"
    assert result.provider == "geocodio"

    request = captured[0]
    assert str(request.url.copy_with(query=None)) == GEOCODIO_GEOCODE_URL
    assert request.url.params["q"] == POSTAL_CODE
    assert request.url.params["country"] == "USA"
    assert request.url.params["limit"] == "1"
    assert request.url.params["api_key"] == API_KEY


def test_resolver_rejects_different_returned_zip() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            request=request,
            json=centroid_payload(postal_code="29506"),
        )

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        resolver = GeocodioPostalCentroidResolver(settings=settings(), client=client)
        with pytest.raises(GeocodingProviderError, match="different postal code"):
            resolver.resolve(POSTAL_CODE)


def test_resolver_rejects_non_centroid_accuracy_type() -> None:
    payload = centroid_payload()
    payload["results"][0]["accuracy_type"] = "rooftop"

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, request=request, json=payload)

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        resolver = GeocodioPostalCentroidResolver(settings=settings(), client=client)
        with pytest.raises(GeocodingProviderError, match="postal centroid"):
            resolver.resolve(POSTAL_CODE)


def test_resolver_rejects_malformed_zip_before_network() -> None:
    calls = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return httpx.Response(200, request=request, json=centroid_payload())

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        resolver = GeocodioPostalCentroidResolver(settings=settings(), client=client)
        with pytest.raises(ValueError, match="five-digit"):
            resolver.resolve("2950")

    assert calls == 0
