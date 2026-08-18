"""Strict GM-owned update schema for shared Event table expectations."""

from pydantic import BaseModel, ConfigDict, Field


class TableExpectationsUpdateRequest(BaseModel):
    """Complete editable expectations surface before any Player acknowledgement."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    tone: str | None = Field(default=None, min_length=1, max_length=80)
    age_expectation: str | None = Field(default=None, min_length=1, max_length=120)
    table_style: str | None = Field(default=None, min_length=1, max_length=160)
    pvp_policy: str | None = Field(default=None, min_length=1, max_length=120)
    homebrew_policy: str | None = Field(default=None, min_length=1, max_length=200)
    character_death_policy: str | None = Field(default=None, min_length=1, max_length=200)
    mature_content_policy: str | None = Field(default=None, min_length=1, max_length=200)
    alcohol_policy: str | None = Field(default=None, min_length=1, max_length=200)
    new_players_welcome: bool | None = None
    break_policy: str | None = Field(default=None, min_length=1, max_length=200)
    safety_framework: str | None = Field(default=None, max_length=2000)
    environment_notes: str | None = Field(default=None, max_length=2000)
    accessibility_notes: str | None = Field(default=None, max_length=2000)
    other_notes: str | None = Field(default=None, max_length=2000)


__all__ = ["TableExpectationsUpdateRequest"]
