"""Strict role-safe schemas for table formation, Events, seats, and Venue approval."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class FormTableMatchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=5000)


class FormTableMatchResponse(BaseModel):
    game_series_id: UUID
    event_id: UUID
    venue_booking_request_id: UUID
    created: bool


class RegistrationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    expectations_acknowledged: Literal[True]


class RegistrationDecisionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: Literal["confirmed", "waitlisted", "declined", "removed"]


class RegistrationCancellationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: Literal["cancelled"]


class RegistrationMutationResponse(BaseModel):
    registration_id: UUID
    status: str
    event_status: str
    expected_guests: int = Field(ge=1)


class VenueBookingTransitionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    status: Literal["question", "approved", "declined", "cancelled"]
    venue_message: str | None = Field(default=None, max_length=2000)


class VenueBookingTransitionResponse(BaseModel):
    booking_id: UUID
    event_id: UUID
    status: str
    event_status: str
    expected_guests: int = Field(ge=1)


class EventSystemResponse(BaseModel):
    slug: str
    name: str
    edition: str | None


class EventVenueResponse(BaseModel):
    id: UUID
    name: str
    city: str
    state_region: str


class EventExpectationsResponse(BaseModel):
    tone: str | None
    age_expectation: str | None
    table_style: str | None
    pvp_policy: str | None
    homebrew_policy: str | None
    character_death_policy: str | None
    mature_content_policy: str | None
    alcohol_policy: str | None
    new_players_welcome: bool
    break_policy: str | None
    safety_framework: str | None
    environment_notes: str | None
    accessibility_notes: str | None
    other_notes: str | None


class EventFormationResponse(BaseModel):
    id: UUID
    slug: str
    title: str
    description: str | None
    status: str
    event_type: str
    join_mode: str
    starts_at: datetime
    ends_at: datetime
    min_players: int = Field(ge=1)
    max_players: int = Field(ge=1)
    minimum_age: int | None = Field(default=None, ge=0, le=120)
    beginner_friendly: bool
    system: EventSystemResponse
    venue: EventVenueResponse
    confirmed_players: int = Field(ge=0)
    requested_players: int = Field(ge=0)
    waitlisted_players: int = Field(ge=0)
    expected_guests: int = Field(ge=1)
    booking_status: str
    booking_id: UUID | None = None
    viewer_roles: list[str]
    your_registration_id: UUID | None = None
    your_registration_status: str | None = None


class EventFormationDetailResponse(EventFormationResponse):
    expectations: EventExpectationsResponse


class GMRegistrationQueueItemResponse(BaseModel):
    id: UUID
    player_profile_id: UUID
    status: str
    requested_at: datetime
    expectations_acknowledged: bool


__all__ = [
    "EventFormationDetailResponse",
    "EventFormationResponse",
    "FormTableMatchRequest",
    "FormTableMatchResponse",
    "GMRegistrationQueueItemResponse",
    "RegistrationCancellationRequest",
    "RegistrationDecisionRequest",
    "RegistrationMutationResponse",
    "RegistrationRequest",
    "VenueBookingTransitionRequest",
    "VenueBookingTransitionResponse",
]
