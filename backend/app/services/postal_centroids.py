"""Provider-neutral ZIP-centroid contracts for privacy-preserving matching."""

from dataclasses import dataclass
from re import fullmatch
from typing import Protocol

from app.services.geo_distance import GeoPoint
from app.services.geocoding import GeocodingProviderError

MINIMUM_POSTAL_CENTROID_ACCURACY = 0.80
POSTAL_CENTROID_ACCURACY_TYPE = "place"


@dataclass(frozen=True, slots=True)
class PostalCentroidResult:
    """One validated U.S. ZIP centroid returned by a provider."""

    postal_code: str
    latitude: float
    longitude: float
    accuracy: float
    accuracy_type: str
    provider: str

    @property
    def point(self) -> GeoPoint:
        """Return the coordinate as the shared distance value object."""

        return GeoPoint(latitude=self.latitude, longitude=self.longitude)


class PostalCentroidResolver(Protocol):
    """Contract for resolving one U.S. ZIP code to a public centroid."""

    def resolve(self, postal_code: str) -> PostalCentroidResult:
        """Resolve one normalized five-digit ZIP code."""
        ...


def normalize_us_postal_code(postal_code: str) -> str:
    """Return one valid five-digit U.S. ZIP code or raise ValueError."""

    normalized = postal_code.strip()
    if fullmatch(r"\d{5}", normalized) is None:
        raise ValueError("Postal code must be a five-digit U.S. ZIP code.")
    return normalized


def require_valid_postal_centroid(
    result: PostalCentroidResult,
    *,
    expected_postal_code: str,
) -> PostalCentroidResult:
    """Reject malformed, mismatched, or non-centroid provider results."""

    normalized = normalize_us_postal_code(expected_postal_code)
    if result.postal_code != normalized:
        raise GeocodingProviderError("Geocoder returned a different postal code.")

    try:
        GeoPoint(latitude=result.latitude, longitude=result.longitude)
    except ValueError as exc:
        raise GeocodingProviderError("Geocoder returned invalid centroid coordinates.") from exc

    if not 0 <= result.accuracy <= 1:
        raise GeocodingProviderError("Geocoder returned an invalid accuracy score.")
    if result.accuracy < MINIMUM_POSTAL_CENTROID_ACCURACY:
        raise GeocodingProviderError("Geocoder returned an unreliable postal centroid.")
    if result.accuracy_type != POSTAL_CENTROID_ACCURACY_TYPE:
        raise GeocodingProviderError("Geocoder did not return a postal centroid result.")
    if not result.provider.strip():
        raise GeocodingProviderError("Geocoder returned an invalid provider name.")

    return result


__all__ = [
    "MINIMUM_POSTAL_CENTROID_ACCURACY",
    "POSTAL_CENTROID_ACCURACY_TYPE",
    "PostalCentroidResolver",
    "PostalCentroidResult",
    "normalize_us_postal_code",
    "require_valid_postal_centroid",
]
