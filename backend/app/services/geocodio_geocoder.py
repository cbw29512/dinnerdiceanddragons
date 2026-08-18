"""Geocodio adapter for server-side public Venue geocoding."""

from typing import Any

import httpx

from app.core.config import Settings, get_settings
from app.services.geocoding import (
    GeocodedLocation,
    GeocodingConfigurationError,
    GeocodingNoMatchError,
    GeocodingProviderError,
    VenueAddress,
    require_precise_venue_location,
)

GEOCODIO_GEOCODE_URL = "https://api.geocod.io/v2/geocode"


class GeocodioVenueGeocoder:
    """Resolve U.S. public Venue addresses through Geocodio."""

    def __init__(
        self,
        *,
        settings: Settings | None = None,
        client: httpx.Client | None = None,
    ) -> None:
        self._settings = settings or get_settings()
        self._client = client

    def geocode(self, address: VenueAddress) -> GeocodedLocation:
        """Return one sufficiently precise Geocodio result."""

        configured_key = self._settings.geocodio_api_key
        if configured_key is None:
            raise GeocodingConfigurationError("Server-side geocoding is not configured.")

        api_key = configured_key.get_secret_value().strip()
        if not api_key:
            raise GeocodingConfigurationError("Server-side geocoding is not configured.")

        params = {
            "q": address.formatted(),
            "country": address.country,
            "limit": 1,
            "api_key": api_key,
        }
        timeout = self._settings.outbound_http_timeout_seconds

        try:
            if self._client is not None:
                response = self._client.get(
                    GEOCODIO_GEOCODE_URL,
                    params=params,
                    timeout=timeout,
                )
            else:
                with httpx.Client(timeout=timeout) as client:
                    response = client.get(
                        GEOCODIO_GEOCODE_URL,
                        params=params,
                    )
        except httpx.RequestError:
            raise GeocodingProviderError("Geocoding provider request failed.") from None

        if response.status_code in {401, 403}:
            raise GeocodingConfigurationError(
                "Geocoding provider rejected the configured credentials."
            )

        if response.status_code >= 400:
            raise GeocodingProviderError("Geocoding provider request failed.")

        try:
            payload = response.json()
        except ValueError:
            raise GeocodingProviderError("Geocoding provider returned malformed JSON.") from None

        if not isinstance(payload, dict):
            raise GeocodingProviderError("Geocoding provider returned malformed data.")

        results = payload.get("results")
        if not isinstance(results, list):
            raise GeocodingProviderError("Geocoding provider returned malformed results.")

        if not results:
            raise GeocodingNoMatchError("Venue address could not be geocoded.")

        first = results[0]
        if not isinstance(first, dict):
            raise GeocodingProviderError("Geocoding provider returned malformed results.")

        location = first.get("location")
        if not isinstance(location, dict):
            raise GeocodingProviderError("Geocoding provider returned malformed coordinates.")

        latitude = _require_number(location.get("lat"), "latitude")
        longitude = _require_number(location.get("lng"), "longitude")
        accuracy = _require_number(first.get("accuracy"), "accuracy")

        accuracy_type = first.get("accuracy_type")
        if not isinstance(accuracy_type, str) or not accuracy_type:
            raise GeocodingProviderError("Geocoding provider returned an invalid accuracy type.")

        return require_precise_venue_location(
            GeocodedLocation(
                latitude=latitude,
                longitude=longitude,
                accuracy=accuracy,
                accuracy_type=accuracy_type,
                provider="geocodio",
            )
        )


def _require_number(value: Any, field_name: str) -> float:
    """Return one provider numeric field without accepting booleans."""

    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise GeocodingProviderError(f"Geocoding provider returned an invalid {field_name}.")

    return float(value)
