"""Authenticated Player onboarding API schemas."""

from decimal import Decimal
from typing import Annotated, Self
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

from app.models.player_profile import PreferredGameFormat
from app.models.player_system_experience import PlayerComfortLevel
from app.schemas.availability import AvailabilityWindowInput

EnvironmentPreference = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=120),
]


class PlayerSystemExperienceInput(BaseModel):
    """One self-described Player experience entry resolved by catalog slug."""

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
    comfort_level: PlayerComfortLevel
    experience_notes: str | None = Field(default=None, max_length=2000)


class PlayerOnboardingRequest(BaseModel):
    """Full replacement of the authenticated caller's Step 2 Player state."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    display_name: str = Field(min_length=1, max_length=80)
    bio: str | None = None
    postal_code: str = Field(min_length=5, max_length=5)
    travel_radius_miles: int = Field(ge=1, le=100)
    preferred_format: PreferredGameFormat = PreferredGameFormat.ANY
    willing_to_learn_new_system: bool = True
    environment_preferences: list[EnvironmentPreference] = Field(
        default_factory=list,
        max_length=20,
    )
    accessibility_notes_private: str | None = None
    systems: list[PlayerSystemExperienceInput] = Field(min_length=1, max_length=20)
    availability: list[AvailabilityWindowInput] = Field(min_length=1, max_length=14)

    @model_validator(mode="after")
    def reject_duplicate_systems(self) -> Self:
        """Keep replacement semantics deterministic for system experience."""

        slugs = [item.system_slug for item in self.systems]
        if len(slugs) != len(set(slugs)):
            raise ValueError(
                "Each game system may appear only once in Player onboarding."
            )
        return self


class PlayerOnboardingResponse(BaseModel):
    """Safe confirmation of the Player state persisted by the server."""

    player_profile_id: UUID
    display_name: str
    role: str
    system_slugs: list[str]
    availability_count: int
