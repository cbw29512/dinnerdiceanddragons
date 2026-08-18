"""Authenticated Venue onboarding API schemas."""

from typing import Annotated, Self
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    field_validator,
    model_validator,
)

from app.models.venue import VenueManagerRole, VenueSupportOffering, VenueType

Amenity = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=120),
]


class VenueOnboardingRequest(BaseModel):
    """Create one public Venue and an unverified manager claim."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    name: str = Field(min_length=1, max_length=160)
    venue_type: VenueType = VenueType.PUBLIC_VENUE
    address_line1: str = Field(min_length=1, max_length=200)
    address_line2: str | None = Field(default=None, max_length=200)
    city: str = Field(min_length=1, max_length=100)
    state_region: str = Field(min_length=2, max_length=2)
    postal_code: str = Field(min_length=5, max_length=5, pattern=r"^[0-9]{5}$")
    website_url: str | None = Field(default=None, max_length=500)
    phone: str | None = Field(default=None, max_length=40)
    amenities: list[Amenity] = Field(default_factory=list, max_length=30)
    host_support_offerings: list[VenueSupportOffering] = Field(default_factory=list, max_length=30)
    host_support_notes: str | None = Field(default=None, max_length=2000)
    accessibility_notes: str | None = Field(default=None, max_length=2000)
    parking_notes: str | None = Field(default=None, max_length=2000)
    noise_notes: str | None = Field(default=None, max_length=2000)
    lighting_notes: str | None = Field(default=None, max_length=2000)
    manager_role: VenueManagerRole = VenueManagerRole.MANAGER

    @field_validator("state_region")
    @classmethod
    def normalize_state_region(cls, value: str) -> str:
        """Store US pilot state abbreviations in the canonical uppercase form."""

        return value.upper()

    @model_validator(mode="after")
    def reject_duplicate_list_values(self) -> Self:
        """Keep amenity/support inputs deterministic for matching and display."""

        amenities = [item.casefold() for item in self.amenities]
        if len(amenities) != len(set(amenities)):
            raise ValueError("Each venue amenity may appear only once.")

        support = [item.value for item in self.host_support_offerings]
        if len(support) != len(set(support)):
            raise ValueError("Each venue support offering may appear only once.")
        return self


class VenueOnboardingResponse(BaseModel):
    """Safe confirmation of a newly created Venue claim."""

    venue_id: UUID
    venue_manager_id: UUID
    name: str
    slug: str
    role: str
    venue_verified: bool
    manager_verified: bool
