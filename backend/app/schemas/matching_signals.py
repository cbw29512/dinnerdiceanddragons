"""Authenticated request and response schemas for Step 3 Table Match inputs."""

from typing import Annotated, Self
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

from app.models.gm_system_experience import GMGameFormat
from app.models.player_profile import PreferredGameFormat
from app.models.venue import VenueSupportOffering
from app.schemas.availability import AvailabilityWindowInput

ShortPreference = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=120),
]


class PlayerDemandCreate(BaseModel):
    """Create one intent signal owned by the authenticated Player profile."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    system_slug: str = Field(
        min_length=1,
        max_length=120,
        pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$",
    )
    preferred_format: PreferredGameFormat = PreferredGameFormat.ANY
    preferred_cadence: str | None = Field(default=None, max_length=32)
    minimum_age_preference: int | None = Field(default=None, ge=0, le=120)
    table_style_preferences: list[ShortPreference] = Field(default_factory=list, max_length=20)
    environment_preferences: list[ShortPreference] = Field(default_factory=list, max_length=20)


class PlayerDemandResponse(PlayerDemandCreate):
    """Safe owner-facing representation of one Player demand signal."""

    id: UUID
    status: str


class GMSupplyCreate(BaseModel):
    """Create one capability/supply signal owned by the authenticated GM profile."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    system_slug: str = Field(
        min_length=1,
        max_length=120,
        pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$",
    )
    preferred_format: GMGameFormat
    preferred_cadence: str | None = Field(default=None, max_length=32)
    minimum_players: int = Field(ge=1, le=20)
    maximum_players: int = Field(ge=1, le=20)
    table_style: str | None = Field(default=None, max_length=2000)

    @model_validator(mode="after")
    def validate_player_range(self) -> Self:
        """Reject impossible GM capacity ranges before persistence."""

        if self.maximum_players < self.minimum_players:
            raise ValueError("maximum_players cannot be below minimum_players.")
        return self


class GMSupplyResponse(GMSupplyCreate):
    """Safe owner-facing representation of one GM supply signal."""

    id: UUID
    status: str


class VenueTableWindowCreate(BaseModel):
    """Create one recurring table-capacity window for a verified managed Venue."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    availability: AvailabilityWindowInput
    table_count: int = Field(ge=1, le=100)
    max_people_per_table: int = Field(ge=1, le=100)
    purchase_policy: str | None = Field(default=None, max_length=2000)
    approval_required: bool = True
    special_support_offerings: list[VenueSupportOffering] = Field(
        default_factory=list,
        max_length=30,
    )
    special_support_notes: str | None = Field(default=None, max_length=2000)
    environment_notes: str | None = Field(default=None, max_length=2000)

    @model_validator(mode="after")
    def reject_duplicate_support_offerings(self) -> Self:
        """Keep per-window support values deterministic for display and matching."""

        values = [item.value for item in self.special_support_offerings]
        if len(values) != len(set(values)):
            raise ValueError("Each special Venue support offering may appear only once.")
        return self


class VenueTableWindowResponse(VenueTableWindowCreate):
    """Safe manager-facing representation of one Venue table window."""

    id: UUID
    venue_id: UUID
    active: bool
