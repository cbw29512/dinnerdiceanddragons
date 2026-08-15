"""Production public Venue and Venue Manager persistence."""

from datetime import datetime
from enum import StrEnum
from uuid import UUID, uuid4

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class VenueType(StrEnum):
    """Canonical public venue categories used by discovery and matching."""

    RESTAURANT = "restaurant"
    BREWERY = "brewery"
    CAFE = "cafe"
    GAME_STORE = "game_store"
    LIBRARY = "library"
    COMMUNITY_CENTER = "community_center"
    PUBLIC_VENUE = "public_venue"
    OTHER = "other"


class VenueManagerRole(StrEnum):
    """Relationship label for a person authorized to represent a Venue."""

    OWNER = "owner"
    MANAGER = "manager"
    STAFF = "staff"


class Venue(Base):
    """Public place where DDD games may be hosted."""

    __tablename__ = "venues"
    __table_args__ = (
        UniqueConstraint("slug", name="uq_venues_slug"),
        CheckConstraint(
            "length(trim(name)) BETWEEN 1 AND 160",
            name="ck_venues_name_length",
        ),
        CheckConstraint(
            "length(trim(slug)) BETWEEN 1 AND 180",
            name="ck_venues_slug_length",
        ),
        CheckConstraint("slug = lower(slug)", name="ck_venues_slug_lowercase"),
        CheckConstraint(
            "venue_type IN "
            "('restaurant', 'brewery', 'cafe', 'game_store', 'library', "
            "'community_center', 'public_venue', 'other')",
            name="ck_venues_venue_type",
        ),
        CheckConstraint(
            "length(state_region) = 2",
            name="ck_venues_state_region_length",
        ),
        CheckConstraint(
            "state_region = upper(state_region)",
            name="ck_venues_state_region_uppercase",
        ),
        CheckConstraint(
            "length(postal_code) = 5",
            name="ck_venues_postal_code_length",
        ),
        CheckConstraint(
            "latitude IS NULL OR latitude BETWEEN -90 AND 90",
            name="ck_venues_latitude_range",
        ),
        CheckConstraint(
            "longitude IS NULL OR longitude BETWEEN -180 AND 180",
            name="ck_venues_longitude_range",
        ),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    slug: Mapped[str] = mapped_column(String(180), nullable=False)
    venue_type: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default=VenueType.PUBLIC_VENUE.value,
        server_default=VenueType.PUBLIC_VENUE.value,
    )
    address_line1: Mapped[str] = mapped_column(String(200), nullable=False)
    address_line2: Mapped[str | None] = mapped_column(String(200), nullable=True)
    city: Mapped[str] = mapped_column(String(100), nullable=False)
    state_region: Mapped[str] = mapped_column(String(2), nullable=False)
    postal_code: Mapped[str] = mapped_column(String(5), nullable=False)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    website_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(40), nullable=True)
    verified: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default=text("false"),
    )
    amenities: Mapped[list[str]] = mapped_column(
        JSON,
        nullable=False,
        default=list,
        server_default=text("'[]'"),
    )
    accessibility_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    parking_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    noise_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    lighting_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default=text("true"),
    )


class VenueManager(Base):
    """A DDD User's relationship to one public Venue."""

    __tablename__ = "venue_managers"
    __table_args__ = (
        UniqueConstraint(
            "venue_id",
            "user_id",
            name="uq_venue_managers_venue_id_user_id",
        ),
        CheckConstraint(
            "role IN ('owner', 'manager', 'staff')",
            name="ck_venue_managers_role",
        ),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    venue_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("venues.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role: Mapped[str] = mapped_column(
        String(24),
        nullable=False,
        default=VenueManagerRole.MANAGER.value,
        server_default=VenueManagerRole.MANAGER.value,
    )
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
