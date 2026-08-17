"""Provider-neutral geocoding contracts for public Venue addresses."""

from dataclasses import dataclass
from typing import Protocol

from app.models.venue import Venue

MINIMUM_VENUE_GEOCODING_ACCURACY = 0.80
ACCEPTED_VENUE_ACCURACY_TYPES = frozenset(
    {
        "rooftop",
        "point",
        "range_interpolation",
        "nearest_rooftop_match",
    }
)


class GeocodingError(RuntimeError):
    """Base failure for server-side geocoding."""


class GeocodingConfigurationError(GeocodingError):
    """The configured geocoding provider cannot be used."""


class GeocodingProviderError(GeocodingError):
    """The geocoding provider failed or returned malformed data."""


class GeocodingNoMatchError(GeocodingError):
    """No geographic result was returned for the Venue address."""


class GeocodingPrecisionError(GeocodingError):
    """The provider result is too imprecise for Venue travel matching."""


@dataclass(frozen=True, slots=True)
class VenueAddress:
    """Canonical public U.S. Venue address sent to a geocoding provider."""

    address_line1: str
    address_line2: str | None
    city: str
    state_region: str
    postal_code: str
    country: str = "USA"

    def formatted(self) -> str:
        """Return one normalized address string for forward geocoding."""

        parts = [self.address_line1]
        if self.address_line2:
            parts.append(self.address_line2)
        parts.append(f"{self.city}, {self.state_region} {self.postal_code}")
        return ", ".join(parts)


@dataclass(frozen=True, slots=True)
class GeocodedLocation:
    """Provider result accepted for possible Venue coordinate caching."""

    latitude: float
    longitude: float
    accuracy: float
    accuracy_type: str
    provider: str


class VenueGeocoder(Protocol):
    """Contract implemented by a server-side Venue geocoding provider."""

    def geocode(self, address: VenueAddress) -> GeocodedLocation:
        """Resolve one public Venue address into geographic coordinates."""
        ...


def venue_address_from_model(venue: Venue) -> VenueAddress:
    """Build a provider-neutral address from persisted Venue fields."""

    return VenueAddress(
        address_line1=venue.address_line1,
        address_line2=venue.address_line2,
        city=venue.city,
        state_region=venue.state_region,
        postal_code=venue.postal_code,
    )


def require_precise_venue_location(location: GeocodedLocation) -> GeocodedLocation:
    """Reject malformed or insufficiently precise Venue geocoding results."""

    if not -90 <= location.latitude <= 90:
        raise GeocodingProviderError("Geocoder returned an invalid latitude.")
    if not -180 <= location.longitude <= 180:
        raise GeocodingProviderError("Geocoder returned an invalid longitude.")
    if not 0 <= location.accuracy <= 1:
        raise GeocodingProviderError("Geocoder returned an invalid accuracy score.")

    if (
        location.accuracy < MINIMUM_VENUE_GEOCODING_ACCURACY
        or location.accuracy_type not in ACCEPTED_VENUE_ACCURACY_TYPES
    ):
        raise GeocodingPrecisionError(
            "Venue address could not be resolved precisely enough for travel matching."
        )

    return location
