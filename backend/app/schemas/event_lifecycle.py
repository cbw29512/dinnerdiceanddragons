"""Role-safe request/response schemas for Event formation lifecycle."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class RegistrationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    expectations_acknowledged: Literal[True]


class PlayerRegistrationAction(BaseModel):
    model_config = ConfigDict(extra="forbid")
    action: Literal["cancel"]


class GMRegistrationAction(BaseModel):
    model_config = ConfigDict(extra="forbid")
    action: Literal["confirm", "decline", "remove"]


class VenueBookingAction(BaseModel):
    model_config = ConfigDict(extra="forbid")
    action: Literal["approve", "question", "decline", "cancel"]
    message: str | None = Field(default=None, max_length=4000)


class RegistrationResponse(BaseModel):
    id: UUID
    event_id: UUID
    status: str
    expectations_acknowledged_at: datetime | None
    requested_at: datetime
    responded_at: datetime | None
    cancelled_at: datetime | None


class VenueBookingResponse(BaseModel):
    id: UUID
    event_id: UUID | None
    status: str
    expected_guests: int
    requested_start: datetime
    requested_end: datetime
    venue_message: str | None


class EventExpectationsResponse(BaseModel):
    tone: str | None
    age_environment: str | None
    play_style: str
    boundaries: str
    pvp_policy: str | None
    homebrew_policy: str | None
    character_death_policy: str | None
    mature_content_notes: str | None
    alcohol_policy: str | None
    new_players_welcome: bool
    break_policy: str | None
    safety_framework: str | None
    environment_notes: str | None
    accessibility_notes: str | None
    other_notes: str | None


class EventResponse(BaseModel):
    id: UUID
    slug: str
    title: str
    description: str
    status: str
    event_type: str
    join_mode: str
    starts_at: datetime
    ends_at: datetime
    min_players: int
    max_players: int
    confirmed_players: int
    minimum_age: int | None
    beginner_friendly: bool
    system_name: str
    system_edition: str | None
    venue_name: str
    venue_city: str
    venue_state_region: str
    viewer_roles: list[str]
    booking: VenueBookingResponse
    expectations: EventExpectationsResponse
    your_registration: RegistrationResponse | None = None
