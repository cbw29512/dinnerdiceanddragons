"""Low-level persistence operations for Venue onboarding."""

import logging
import re
import unicodedata
from uuid import uuid4

from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.venue import Venue, VenueManager
from app.schemas.venue_onboarding import VenueOnboardingRequest
from app.services.onboarding_common import OnboardingConflictError

LOGGER = logging.getLogger(__name__)


def optional_text(value: str | None) -> str | None:
    """Store blank optional text as NULL rather than an empty string."""

    try:
        return value if value else None
    except Exception:
        LOGGER.exception("Failed to normalize optional Venue onboarding text")
        raise


def venue_slug_base(name: str, city: str, state_region: str) -> str:
    """Create a readable lowercase slug base from public Venue identity fields."""

    try:
        raw = f"{name}-{city}-{state_region}"
        ascii_value = unicodedata.normalize("NFKD", raw).encode("ascii", "ignore").decode()
        slug = re.sub(r"[^a-z0-9]+", "-", ascii_value.casefold()).strip("-")
        return slug[:160] or "venue"
    except Exception:
        LOGGER.exception("Failed to prepare Venue slug base")
        raise


def ensure_venue_is_new(session: Session, payload: VenueOnboardingRequest) -> None:
    """Reject an apparent duplicate until the existing-Venue claim flow exists."""

    try:
        existing = session.scalar(
            select(Venue.id).where(
                func.lower(Venue.name) == payload.name.casefold(),
                func.lower(Venue.address_line1) == payload.address_line1.casefold(),
                func.lower(Venue.city) == payload.city.casefold(),
                Venue.state_region == payload.state_region,
                Venue.postal_code == payload.postal_code,
            )
        )
    except SQLAlchemyError:
        LOGGER.exception("Failed to check for an existing Venue")
        raise

    if existing is not None:
        raise OnboardingConflictError(
            "That venue already appears to exist. Use the existing-venue claim flow."
        )


def create_venue_and_claim(
    session: Session,
    user: User,
    payload: VenueOnboardingRequest,
) -> tuple[Venue, VenueManager]:
    """Create a Venue and an intentionally unverified manager relationship."""

    try:
        venue_id = uuid4()
        slug = f"{venue_slug_base(payload.name, payload.city, payload.state_region)}-{venue_id.hex[:8]}"
        venue = Venue(
            id=venue_id,
            name=payload.name,
            slug=slug[:180],
            venue_type=payload.venue_type.value,
            address_line1=payload.address_line1,
            address_line2=optional_text(payload.address_line2),
            city=payload.city,
            state_region=payload.state_region,
            postal_code=payload.postal_code,
            latitude=None,
            longitude=None,
            website_url=optional_text(payload.website_url),
            phone=optional_text(payload.phone),
            verified=False,
            amenities=list(payload.amenities),
            accessibility_notes=optional_text(payload.accessibility_notes),
            parking_notes=optional_text(payload.parking_notes),
            noise_notes=optional_text(payload.noise_notes),
            lighting_notes=optional_text(payload.lighting_notes),
            active=True,
        )
        session.add(venue)
        session.flush()

        relationship = VenueManager(
            venue_id=venue.id,
            user_id=user.id,
            role=payload.manager_role.value,
            verified_at=None,
        )
        session.add(relationship)
        session.flush()
        return venue, relationship
    except SQLAlchemyError:
        LOGGER.exception("Failed to create Venue claim for user %s", user.id)
        raise
