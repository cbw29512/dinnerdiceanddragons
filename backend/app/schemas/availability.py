"""Validated request shapes for recurring availability windows."""

from datetime import date, time
from typing import Self
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.recurring_availability_rule import (
    AvailabilityDay,
    AvailabilityPatternType,
    MonthlyOrdinal,
)


class AvailabilityWindowInput(BaseModel):
    """Canonical recurring schedule input shared by Player and GM onboarding."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    day_of_week: AvailabilityDay
    start_time: time
    end_time: time
    pattern_type: AvailabilityPatternType
    week_interval: int | None = Field(default=None, ge=1, le=4)
    anchor_date: date | None = None
    monthly_ordinal: MonthlyOrdinal | None = None
    month_interval: int | None = Field(default=None, ge=1, le=3)
    timezone: str = Field(min_length=1, max_length=64)
    starts_on: date | None = None
    ends_on: date | None = None

    @model_validator(mode="after")
    def validate_schedule(self) -> Self:
        """Reject schedule shapes that would fail production DB invariants."""

        if self.start_time.tzinfo is not None or self.end_time.tzinfo is not None:
            raise ValueError("Availability times must be local clock times without offsets.")
        if self.start_time >= self.end_time:
            raise ValueError("Availability start time must be before end time.")
        if self.starts_on and self.ends_on and self.starts_on > self.ends_on:
            raise ValueError("Availability starts_on cannot be after ends_on.")

        try:
            ZoneInfo(self.timezone)
        except (ZoneInfoNotFoundError, ValueError) as exc:
            raise ValueError("Availability timezone must be a valid IANA timezone.") from exc

        if self.pattern_type == AvailabilityPatternType.WEEKLY_INTERVAL:
            self._validate_weekly_pattern()
        else:
            self._validate_monthly_pattern()
        return self

    def _validate_weekly_pattern(self) -> None:
        if self.week_interval is None:
            raise ValueError("Weekly availability requires week_interval.")
        if self.monthly_ordinal is not None or self.month_interval is not None:
            raise ValueError("Weekly availability cannot include monthly recurrence fields.")
        if self.week_interval == 1 and self.anchor_date is not None:
            raise ValueError("Every-week availability must not include anchor_date.")
        if self.week_interval > 1 and self.anchor_date is None:
            raise ValueError("Alternating weekly availability requires anchor_date.")

    def _validate_monthly_pattern(self) -> None:
        if self.week_interval is not None:
            raise ValueError("Monthly availability cannot include week_interval.")
        if self.monthly_ordinal is None or self.month_interval is None:
            raise ValueError("Monthly availability requires ordinal and month_interval.")
        if self.month_interval == 1 and self.anchor_date is not None:
            raise ValueError("Every-month availability must not include anchor_date.")
        if self.month_interval > 1 and self.anchor_date is None:
            raise ValueError("Alternating monthly availability requires anchor_date.")
