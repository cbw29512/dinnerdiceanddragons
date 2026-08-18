"""Validated request/response schemas for Table Match conversion."""

from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.event import EventJoinMode, EventType


class TableExpectationsInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    tone: str | None = Field(default=None, max_length=200)
    age_environment: str | None = Field(default=None, max_length=120)
    play_style: str = Field(min_length=1, max_length=2000)
    boundaries: str = Field(min_length=1, max_length=4000)
    pvp_policy: str | None = Field(default=None, max_length=300)
    homebrew_policy: str | None = Field(default=None, max_length=4000)
    character_death_policy: str | None = Field(default=None, max_length=500)
    mature_content_notes: str | None = Field(default=None, max_length=4000)
    alcohol_policy: str | None = Field(default=None, max_length=500)
    new_players_welcome: bool = True
    break_policy: str | None = Field(default=None, max_length=500)
    safety_framework: str | None = Field(default=None, max_length=1000)
    environment_notes: str | None = Field(default=None, max_length=4000)
    accessibility_notes: str | None = Field(default=None, max_length=4000)
    other_notes: str | None = Field(default=None, max_length=4000)


class FormTableMatchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=1, max_length=8000)
    event_type: EventType = EventType.ONE_SHOT
    join_mode: EventJoinMode = EventJoinMode.REQUEST_TO_JOIN
    minimum_age: int | None = Field(default=None, ge=0, le=125)
    beginner_friendly: bool = True
    expected_sessions: int = Field(default=1, ge=1, le=52)
    gm_message: str | None = Field(default=None, max_length=4000)
    expectations: TableExpectationsInput


class FormTableMatchResponse(BaseModel):
    table_match_id: UUID
    game_table_id: UUID | None
    event_id: UUID
    game_series_id: UUID | None
    venue_booking_request_id: UUID
    event_status: str
    booking_status: str
    created: bool
