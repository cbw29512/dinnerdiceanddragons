"""Geocodio adapter for privacy-preserving U.S. ZIP centroids."""

from typing import Any

import httpx

from app.core.config import Settings, get_settings
from app.services.geocoding import (
    GeocodingConfigurationError,
    GeocodingNoMatchError,
    GeocodingProviderError,
)
from app.services.postal_centroids import (
    PostalCentroidResult,
    normalize_us_postal_code,
    require_valid_postal_centroid,
)

GEOCODIO_GEOCODE_URL = "https://api.geocod.io/v2/geocode"
GEOCODIO_TIMEOUT_SECONDS = 5.0


class GeocodioPostalCentroidResolver:
    """Resolve a five-digit U.S. ZIP code to its approximate centroid."""

    def __init__(
        self,
        *,
        settings: Settings | None = None,
        client: httpx.Client | None = None,
    ) -> None:
        self._settings = settings or get_settings()
        self._client = client

    def resolve(self, postal_code: str) -> PostalCentroidResult:
        """Return one validated ZIP centroid from Geocodio."""

        normalized = normalize_us_postal_code(postal_code)
        api_key = self._api_key()
        params = {
            "q": normalized,
            "country": "USA",
            "limit": 1,
            "api_key": api_key,
        }

        try:
            response = self._get(params)
        except httpx.RequestError:
            raise GeocodingProviderError("Postal geocoding provider request failed.") from None

        if response.status_code in {401, 403}:
            raise GeocodingConfigurationError(
                "Postal geocoding provider rejected the configured credentials."
            )
        if response.status_code >= 400:
            raise GeocodingProviderError("Postal geocoding provider request failed.")

        first = _first_result(response)
        components = first.get("address_components")
        if not isinstance(components, dict):
            raise GeocodingProviderError("Postal geocoder returned malformed address data.")

        returned_postal_code = components.get("postal_code")
        if not isinstance(returned_postal_code, str):
            raise GeocodingProviderError("Postal geocoder returned no postal code.")

        location = first.get("location")
        if not isinstance(location, dict):
            raise GeocodingProviderError("Postal geocoder returned malformed coordinates.")

        accuracy_type = first.get("accuracy_type")
        if not isinstance(accuracy_type, str) or not accuracy_type:
            raise GeocodingProviderError("Postal geocoder returned an invalid accuracy type.")

        result = PostalCentroidResult(
            postal_code=returned_postal_code,
            latitude=_require_number(location.get("lat"), "latitude"),
            longitude=_require_number(location.get("lng"), "longitude"),
            accuracy=_require_number(first.get("accuracy"), "accuracy"),
            accuracy_type=accuracy_type,
            provider="geocodio",
        )
        return require_valid_postal_centroid(
            result,
            expected_postal_code=normalized,
        )

    def _api_key(self) -> str:
        configured_key = self._settings.geocodio_api_key
        if configured_key is None:
            raise GeocodingConfigurationError("Server-side geocoding is not configured.")
        api_key = configured_key.get_secret_value().strip()
        if not api_key:
            raise GeocodingConfigurationError("Server-side geocoding is not configured.")
        return api_key

    def _get(self, params: dict[str, object]) -> httpx.Response:
        if self._client is not None:
            return self._client.get(
                GEOCODIO_GEOCODE_URL,
                params=params,
                timeout=GEOCODIO_TIMEOUT_SECONDS,
            )
        with httpx.Client(timeout=GEOCODIO_TIMEOUT_SECONDS) as client:
            return client.get(GEOCODIO_GEOCODE_URL, params=params)


def _first_result(response: httpx.Response) -> dict[str, Any]:
    try:
        payload = response.json()
    except ValueError:
        raise GeocodingProviderError("Postal geocoder returned malformed JSON.") from None

    if not isinstance(payload, dict):
        raise GeocodingProviderError("Postal geocoder returned malformed data.")
    results = payload.get("results")
    if not isinstance(results, list):
        raise GeocodingProviderError("Postal geocoder returned malformed results.")
    if not results:
        raise GeocodingNoMatchError("Postal code could not be geocoded.")
    first = results[0]
    if not isinstance(first, dict):
        raise GeocodingProviderError("Postal geocoder returned malformed results.")
    return first


def _require_number(value: Any, field_name: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise GeocodingProviderError(f"Postal geocoder returned an invalid {field_name}.")
    return float(value)


__all__ = ["GeocodioPostalCentroidResolver"]
