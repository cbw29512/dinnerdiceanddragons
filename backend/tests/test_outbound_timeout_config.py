"""Configured outbound timeout propagation for auth and geocoding clients."""

from typing import Any

import httpx
from pydantic import SecretStr

from app.auth.supabase_jwt import SupabaseJWTVerifier
from app.core.config import Settings
from app.services.geocoding import VenueAddress
from app.services.geocodio_geocoder import GeocodioVenueGeocoder
from app.services.geocodio_postal_resolver import GeocodioPostalCentroidResolver

TIMEOUT = 2.75


def timeout_settings() -> Settings:
    return Settings(
        _env_file=None,
        supabase_url="https://example.supabase.co",
        geocodio_api_key=SecretStr("test-key"),
        outbound_http_timeout_seconds=TIMEOUT,
    )


def test_supabase_jwks_uses_configured_outbound_timeout(monkeypatch) -> None:
    captured: dict[str, Any] = {}

    class RecordingJWKClient:
        def __init__(self, url: str, **kwargs: Any) -> None:
            captured["url"] = url
            captured.update(kwargs)

    monkeypatch.setattr("app.auth.supabase_jwt.PyJWKClient", RecordingJWKClient)

    verifier = SupabaseJWTVerifier(settings=timeout_settings())

    assert verifier.jwks_url.endswith("/.well-known/jwks.json")
    assert captured["timeout"] == TIMEOUT


def test_venue_geocoder_uses_configured_outbound_timeout() -> None:
    class RecordingClient:
        timeout: float | None = None

        def get(self, url: str, *, params: dict[str, Any], timeout: float) -> httpx.Response:
            self.timeout = timeout
            request = httpx.Request("GET", url, params=params)
            return httpx.Response(
                200,
                request=request,
                json={
                    "results": [
                        {
                            "location": {"lat": 34.1954, "lng": -79.7626},
                            "accuracy": 0.95,
                            "accuracy_type": "rooftop",
                        }
                    ]
                },
            )

    client = RecordingClient()
    GeocodioVenueGeocoder(
        settings=timeout_settings(),
        client=client,  # type: ignore[arg-type]
    ).geocode(
        VenueAddress(
            address_line1="123 Main St",
            address_line2=None,
            city="Florence",
            state_region="SC",
            postal_code="29501",
        )
    )

    assert client.timeout == TIMEOUT


def test_postal_resolver_uses_configured_outbound_timeout() -> None:
    class RecordingClient:
        timeout: float | None = None

        def get(self, url: str, *, params: dict[str, Any], timeout: float) -> httpx.Response:
            self.timeout = timeout
            request = httpx.Request("GET", url, params=params)
            return httpx.Response(
                200,
                request=request,
                json={
                    "results": [
                        {
                            "address_components": {"postal_code": "29501"},
                            "location": {"lat": 34.1954, "lng": -79.7626},
                            "accuracy": 1.0,
                            "accuracy_type": "place",
                        }
                    ]
                },
            )

    client = RecordingClient()
    result = GeocodioPostalCentroidResolver(
        settings=timeout_settings(),
        client=client,  # type: ignore[arg-type]
    ).resolve("29501")

    assert result.postal_code == "29501"
    assert client.timeout == TIMEOUT
