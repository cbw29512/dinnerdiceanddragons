"""Role-safe schemas for the live authenticated Game Hub."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.event_lifecycle import EventResponse

HubMessageChannel = Literal[
    "table_announcement",
    "table_discussion",
    "gm_venue",
    "player_gm",
    "player_venue_question",
]
VenueQuestionCategoryValue = Literal[
    "accessibility",
    "food_allergies",
    "parking",
    "seating",
    "venue_policy",
    "other",
]


class HubCapabilities(BaseModel):
    viewer_roles: list[str]
    post_channels: list[str]
    can_manage_registrations: bool
    can_manage_booking: bool


class HubRegistrationQueueItem(BaseModel):
    registration_id: UUID
    display_name: str
    status: str
    requested_at: datetime
    expectations_acknowledged: bool


class HubIndexItem(BaseModel):
    event_id: UUID
    title: str
    status: str
    starts_at: datetime
    ends_at: datetime
    venue_name: str
    venue_city: str
    venue_state_region: str
    system_name: str
    system_edition: str | None


class GameHubResponse(BaseModel):
    event: EventResponse
    capabilities: HubCapabilities
    registration_queue: list[HubRegistrationQueueItem] = Field(default_factory=list)


class MessageCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    channel_type: HubMessageChannel
    body: str = Field(min_length=1, max_length=4000)
    category: VenueQuestionCategoryValue | None = None
    registration_id: UUID | None = None


class HubMessageResponse(BaseModel):
    id: UUID
    channel_type: str
    category: str | None
    body: str
    created_at: datetime
    sender_display_name: str
    sender_role: str
    mine: bool
    reply_registration_id: UUID | None = None


class HubMessagePageResponse(BaseModel):
    items: list[HubMessageResponse]
    next_cursor: str | None = None


__all__ = [
    "GameHubResponse",
    "HubCapabilities",
    "HubIndexItem",
    "HubMessagePageResponse",
    "HubMessageResponse",
    "HubRegistrationQueueItem",
    "MessageCreateRequest",
]
