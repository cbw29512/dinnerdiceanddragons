"""Role-safe API schemas for explainable Table Match opportunities."""

from datetime import date, datetime
from typing import Self
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class TableMatchRunRequest(BaseModel):
    """Bounded date horizon for an authorized production matcher run."""

    model_config = ConfigDict(extra="forbid")

    window_start: date
    window_end: date

    @model_validator(mode="after")
    def validate_order(self) -> Self:
        if self.window_end < self.window_start:
            raise ValueError("window_end cannot be before window_start.")
        return self


class TableMatchRunResponse(BaseModel):
    """Non-sensitive summary of one matcher run."""

    computed_opportunities: int = Field(ge=0)
    persisted_count: int = Field(ge=0)
    created_count: int = Field(ge=0)
    refreshed_count: int = Field(ge=0)
    expired_count: int = Field(ge=0)


class OpportunitySystemResponse(BaseModel):
    """Public RPG system identity attached to a match."""

    slug: str
    name: str
    edition: str | None


class OpportunityVenueResponse(BaseModel):
    """Public Venue locality safe for opportunity discovery."""

    id: UUID
    name: str
    city: str
    state_region: str


class OpportunityExplanationResponse(BaseModel):
    """Human-readable deterministic reason attached to a match."""

    criterion: str
    result: str
    summary: str


class TableMatchOpportunityResponse(BaseModel):
    """Role-safe summary that never exposes private location anchors."""

    id: UUID
    status: str
    proposed_start: datetime
    proposed_end: datetime
    timezone: str
    minimum_players: int
    maximum_players: int
    compatible_player_count: int
    system: OpportunitySystemResponse
    venue: OpportunityVenueResponse
    viewer_roles: list[str]
    your_player_distance_miles: float | None = None
    your_gm_distance_miles: float | None = None


class TableMatchOpportunityDetailResponse(TableMatchOpportunityResponse):
    """Explainable detail plus only the caller's own Player match facts."""

    your_player_fit_flags: list[str] = Field(default_factory=list)
    your_player_availability_overlap: dict[str, str] | None = None
    explanations: list[OpportunityExplanationResponse] = Field(default_factory=list)
