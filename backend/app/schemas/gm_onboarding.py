"""Authenticated GM onboarding API schemas."""

from decimal import Decimal
from typing import Self
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.gm_system_experience import (
    GMComfortLevel,
    GMGameFormat,
    PreferredPlayerExperience,
)
from app.schemas.availability import AvailabilityWindowInput


class GMSystemExperienceInput(BaseModel):
    """One self-described GM experience entry resolved by catalog slug."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    system_slug: str = Field(
        min_length=1,
        max_length=120,
        pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$",
    )
    years_playing: Decimal = Field(
        ge=Decimal("0"),
        le=Decimal("80"),
        multiple_of=Decimal("0.5"),
    )
    years_gming: Decimal = Field(
        ge=Decimal("0"),
        le=Decimal("80"),
        multiple_of=Decimal("0.5"),
    )
    comfort_level: GMComfortLevel
    preferred_player_experience: PreferredPlayerExperience = PreferredPlayerExperience.ANY
    formats: list[GMGameFormat] = Field(min_length=1, max_length=5)
    experience_notes: str | None = Field(default=None, max_length=2000)

    @model_validator(mode="after")
    def reject_duplicate_formats(self) -> Self:
        """Keep one canonical format row per system experience."""

        if len(self.formats) != len(set(self.formats)):
            raise ValueError("Each GM game format may appear only once per system.")
        return self


class GMOnboardingRequest(BaseModel):
    """Full replacement of the authenticated caller's Step 2 GM state."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    display_name: str = Field(min_length=1, max_length=80)
    bio: str | None = None
    postal_code: str = Field(min_length=5, max_length=5)
    travel_radius_miles: int = Field(ge=1, le=100)
    beginner_friendly: bool = False
    gm_style: str = Field(min_length=1, max_length=2000)
    systems: list[GMSystemExperienceInput] = Field(min_length=1, max_length=20)
    availability: list[AvailabilityWindowInput] = Field(min_length=1, max_length=14)

    @model_validator(mode="after")
    def reject_duplicate_systems(self) -> Self:
        """Keep replacement semantics deterministic for GM system experience."""

        slugs = [item.system_slug for item in self.systems]
        if len(slugs) != len(set(slugs)):
            raise ValueError("Each game system may appear only once in GM onboarding.")
        return self


class GMOnboardingResponse(BaseModel):
    """Safe confirmation of the GM state persisted by the server."""

    gm_profile_id: UUID
    display_name: str
    role: str
    system_slugs: list[str]
    availability_count: int
