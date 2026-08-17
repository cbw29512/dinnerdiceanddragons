"""Geocodio adapter tests with no real network access."""

from typing import Any

import httpx
import pytest
from pydantic import SecretStr

from app.core.config import Settings
from app.services.geocoding import (
    GeocodingConfigurationError,
    GeocodingNoMatchError,
    GeocodingPrecisionError,
    GeocodingProviderError,
    VenueAddress,
)
from app.services.geocodio_geocoder import (
    GEOCODIO_GEOCODE_URL,
    GEOCODIO_TIMEOUT_SECONDS,
    GeocodioVenueGeocoder,
)

API_KEY = "test-geocodio-key"
ADDRESS = VenueAddress(
    address_line1="123 Main St",
    address_line2="Suite 200",
    city="Florence",
    state_region="SC",
    postal_code="29501",
)


def geocodio_settings(api_key: str | None = API_KEY) -> Settings:
    """Build deterministic settings without a real Geocodio credential."""

    return Settings(
        geocodio_api_key=SecretStr(api_key) if api_key is not None else None,
    )


def precise_payload() -> dict[str, Any]:
    """Return one precise provider response suitable for Venue matching."""

    return {
        "results": [
            {
                "location": {
                    "lat": 34.1954,
                    "lng": -79.7626,
                },
                "accuracy": 0.95,
                "accuracy_type": "rooftop",
            }
        ]
    }


def test_precise_result_maps_to_provider_neutral_location() -> None:
    captured_requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        captured_requests.append(request)
        return httpx.Response(
            200,
            request=request,
            json=precise_payload(),
        )

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        result = GeocodioVenueGeocoder(
            settings=geocodio_settings(),
            client=client,
        ).geocode(ADDRESS)

    assert result.latitude == pytest.approx(34.1954)
    assert result.longitude == pytest.approx(-79.7626)
    assert result.accuracy == pytest.approx(0.95)
    assert result.accuracy_type == "rooftop"
    assert result.provider == "geocodio"

    assert len(captured_requests) == 1
    request = captured_requests[0]
    assert str(request.url.copy_with(query=None)) == GEOCODIO_GEOCODE_URL
    assert request.url.params["q"] == "123 Main St, Suite 200, Florence, SC 29501"
    assert request.url.params["country"] == "USA"
    assert request.url.params["limit"] == "1"
    assert request.url.params["api_key"] == API_KEY


@pytest.mark.parametrize("api_key", [None, "   "])
def test_missing_or_blank_api_key_fails_before_network(api_key: str | None) -> None:
    def handler(_: httpx.Request) -> httpx.Response:
        raise AssertionError("Network must not be called without configuration.")

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        geocoder = GeocodioVenueGeocoder(
            settings=geocodio_settings(api_key),
            client=client,
        )

        with pytest.raises(
            GeocodingConfigurationError,
            match="not configured",
        ):
            geocoder.geocode(ADDRESS)


@pytest.mark.parametrize("status_code", [401, 403])
def test_rejected_credentials_are_controlled_and_do_not_expose_key(
    status_code: int,
) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            status_code,
            request=request,
            json={"error": "credential rejected"},
        )

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        geocoder = GeocodioVenueGeocoder(
            settings=geocodio_settings(),
            client=client,
        )

        with pytest.raises(GeocodingConfigurationError) as exc_info:
            geocoder.geocode(ADDRESS)

    assert API_KEY not in str(exc_info.value)


def test_network_failure_is_controlled_and_does_not_expose_key() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError(
            f"failed request: {request.url}",
            request=request,
        )

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        geocoder = GeocodioVenueGeocoder(
            settings=geocodio_settings(),
            client=client,
        )

        with pytest.raises(
            GeocodingProviderError,
            match="provider request failed",
        ) as exc_info:
            geocoder.geocode(ADDRESS)

    assert API_KEY not in str(exc_info.value)


def test_provider_http_failure_is_controlled() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            500,
            request=request,
            json={"error": "provider unavailable"},
        )

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        geocoder = GeocodioVenueGeocoder(
            settings=geocodio_settings(),
            client=client,
        )

        with pytest.raises(
            GeocodingProviderError,
            match="provider request failed",
        ):
            geocoder.geocode(ADDRESS)


def test_malformed_json_is_rejected() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            request=request,
            content=b"not-json",
        )

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        geocoder = GeocodioVenueGeocoder(
            settings=geocodio_settings(),
            client=client,
        )

        with pytest.raises(
            GeocodingProviderError,
            match="malformed JSON",
        ):
            geocoder.geocode(ADDRESS)


@pytest.mark.parametrize(
    "payload",
    [
        [],
        {"results": {}},
        {"results": ["not-a-result"]},
        {"results": [{"location": "not-coordinates"}]},
    ],
)
def test_malformed_provider_shapes_are_rejected(payload: Any) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            request=request,
            json=payload,
        )

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        geocoder = GeocodioVenueGeocoder(
            settings=geocodio_settings(),
            client=client,
        )

        with pytest.raises(GeocodingProviderError):
            geocoder.geocode(ADDRESS)


def test_no_match_is_distinct_from_provider_failure() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            request=request,
            json={"results": []},
        )

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        geocoder = GeocodioVenueGeocoder(
            settings=geocodio_settings(),
            client=client,
        )

        with pytest.raises(
            GeocodingNoMatchError,
            match="could not be geocoded",
        ):
            geocoder.geocode(ADDRESS)


@pytest.mark.parametrize(
    ("accuracy", "accuracy_type"),
    [
        (0.79, "rooftop"),
        (0.99, "place"),
    ],
)
def test_imprecise_results_are_rejected(
    accuracy: float,
    accuracy_type: str,
) -> None:
    payload = precise_payload()
    payload["results"][0]["accuracy"] = accuracy
    payload["results"][0]["accuracy_type"] = accuracy_type

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            request=request,
            json=payload,
        )

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        geocoder = GeocodioVenueGeocoder(
            settings=geocodio_settings(),
            client=client,
        )

        with pytest.raises(
            GeocodingPrecisionError,
            match="precisely enough",
        ):
            geocoder.geocode(ADDRESS)


@pytest.mark.parametrize(
    ("field_name", "bad_value"),
    [
        ("latitude", True),
        ("longitude", "west"),
        ("accuracy", None),
    ],
)
def test_non_numeric_provider_fields_are_rejected(
    field_name: str,
    bad_value: Any,
) -> None:
    payload = precise_payload()
    first = payload["results"][0]

    if field_name == "latitude":
        first["location"]["lat"] = bad_value
    elif field_name == "longitude":
        first["location"]["lng"] = bad_value
    else:
        first["accuracy"] = bad_value

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            request=request,
            json=payload,
        )

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        geocoder = GeocodioVenueGeocoder(
            settings=geocodio_settings(),
            client=client,
        )

        with pytest.raises(
            GeocodingProviderError,
            match=f"invalid {field_name}",
        ):
            geocoder.geocode(ADDRESS)


@pytest.mark.parametrize(
    ("latitude", "longitude", "accuracy"),
    [
        (91.0, -79.7626, 0.95),
        (34.1954, 181.0, 0.95),
        (34.1954, -79.7626, 1.1),
    ],
)
def test_out_of_range_provider_values_are_rejected(
    latitude: float,
    longitude: float,
    accuracy: float,
) -> None:
    payload = precise_payload()
    first = payload["results"][0]
    first["location"]["lat"] = latitude
    first["location"]["lng"] = longitude
    first["accuracy"] = accuracy

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            request=request,
            json=payload,
        )

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        geocoder = GeocodioVenueGeocoder(
            settings=geocodio_settings(),
            client=client,
        )

        with pytest.raises(GeocodingProviderError):
            geocoder.geocode(ADDRESS)


def test_adapter_uses_bounded_request_timeout() -> None:
    class RecordingClient:
        def __init__(self) -> None:
            self.timeout: float | None = None

        def get(
            self,
            url: str,
            *,
            params: dict[str, Any],
            timeout: float,
        ) -> httpx.Response:
            self.timeout = timeout
            request = httpx.Request("GET", url, params=params)
            return httpx.Response(
                200,
                request=request,
                json=precise_payload(),
            )

    client = RecordingClient()
    geocoder = GeocodioVenueGeocoder(
        settings=geocodio_settings(),
        client=client,  # type: ignore[arg-type]
    )

    geocoder.geocode(ADDRESS)

    assert client.timeout == GEOCODIO_TIMEOUT_SECONDS
