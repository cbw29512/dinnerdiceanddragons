"""Reusable recurring availability rules for Players, GMs, and Venues."""

from datetime import date, datetime, time
from enum import StrEnum
from uuid import UUID, uuid4

from sqlalchemy import Boolean, CheckConstraint, Date, DateTime, SmallInteger, String, Time, Uuid, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class AvailabilityOwnerType(StrEnum):
    """Typed owner categories resolved by the later availability-window tables."""

    PLAYER = "player"
    GM = "gm"
    VENUE = "venue"


class AvailabilityDay(StrEnum):
    """Canonical weekday names used by recurrence matching."""

    MONDAY = "monday"
    TUESDAY = "tuesday"
    WEDNESDAY = "wednesday"
    THURSDAY = "thursday"
    FRIDAY = "friday"
    SATURDAY = "saturday"
    SUNDAY = "sunday"


class AvailabilityPatternType(StrEnum):
    """Supported recurring schedule shapes."""

    WEEKLY_INTERVAL = "weekly_interval"
    MONTHLY_ORDINAL_WEEKDAY = "monthly_ordinal_weekday"


class MonthlyOrdinal(StrEnum):
    """Supported ordinal weekday positions within a month."""

    FIRST = "first"
    SECOND = "second"
    THIRD = "third"
    FOURTH = "fourth"
    LAST = "last"


class RecurringAvailabilityRule(Base):
    """A reusable recurring opportunity window, not a guaranteed attendance record."""

    __tablename__ = "recurring_availability_rules"
    __table_args__ = (
        CheckConstraint(
            "owner_type IN ('player', 'gm', 'venue')",
            name="ck_recurring_availability_rules_owner_type",
        ),
        CheckConstraint(
            "day_of_week IN ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')",
            name="ck_recurring_availability_rules_day_of_week",
        ),
        CheckConstraint(
            "pattern_type IN ('weekly_interval', 'monthly_ordinal_weekday')",
            name="ck_recurring_availability_rules_pattern_type",
        ),
        CheckConstraint(
            "start_time < end_time",
            name="ck_recurring_availability_rules_time_order",
        ),
        CheckConstraint(
            "starts_on IS NULL OR ends_on IS NULL OR starts_on <= ends_on",
            name="ck_recurring_availability_rules_date_order",
        ),
        CheckConstraint(
            "length(trim(timezone)) BETWEEN 1 AND 64",
            name="ck_recurring_availability_rules_timezone_length",
        ),
        CheckConstraint(
            "(pattern_type = 'weekly_interval' "
            "AND week_interval BETWEEN 1 AND 4 "
            "AND monthly_ordinal IS NULL "
            "AND month_interval IS NULL "
            "AND ((week_interval = 1 AND anchor_date IS NULL) "
            "OR (week_interval BETWEEN 2 AND 4 AND anchor_date IS NOT NULL))) "
            "OR (pattern_type = 'monthly_ordinal_weekday' "
            "AND week_interval IS NULL "
            "AND monthly_ordinal IN ('first', 'second', 'third', 'fourth', 'last') "
            "AND month_interval BETWEEN 1 AND 3 "
            "AND ((month_interval = 1 AND anchor_date IS NULL) "
            "OR (month_interval BETWEEN 2 AND 3 AND anchor_date IS NOT NULL)))",
            name="ck_recurring_availability_rules_pattern_fields",
        ),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    owner_type: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    owner_id: Mapped[UUID] = mapped_column(Uuid, nullable=False, index=True)
    day_of_week: Mapped[str] = mapped_column(String(16), nullable=False)
    start_time: Mapped[time] = mapped_column(Time(timezone=False), nullable=False)
    end_time: Mapped[time] = mapped_column(Time(timezone=False), nullable=False)
    pattern_type: Mapped[str] = mapped_column(String(32), nullable=False)
    week_interval: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    anchor_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    monthly_ordinal: Mapped[str | None] = mapped_column(String(16), nullable=True)
    month_interval: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    timezone: Mapped[str] = mapped_column(String(64), nullable=False)
    starts_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    ends_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default=text("true"),
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
