"""Timezone and DST tests for production recurrence occurrence windows."""

from datetime import date, time, timedelta

import pytest

from app.models.recurring_availability_rule import RecurringAvailabilityRule
from app.services.recurrence_expansion import RecurrenceTimeError, expand_occurrences


def weekly_rule(**overrides) -> RecurringAvailabilityRule:
    values = {
        "day_of_week": "friday",
        "start_time": time(18, 0),
        "end_time": time(22, 0),
        "pattern_type": "weekly_interval",
        "week_interval": 1,
        "timezone": "America/New_York",
        "active": True,
    }
    values.update(overrides)
    return RecurringAvailabilityRule(**values)


def test_evening_occurrences_preserve_wall_clock_across_dst_change() -> None:
    occurrences = expand_occurrences(
        weekly_rule(),
        date(2026, 3, 6),
        date(2026, 3, 13),
    )

    assert [item.local_date for item in occurrences] == [
        date(2026, 3, 6),
        date(2026, 3, 13),
    ]
    assert [item.start_at.hour for item in occurrences] == [18, 18]
    assert occurrences[0].start_at.utcoffset() == timedelta(hours=-5)
    assert occurrences[1].start_at.utcoffset() == timedelta(hours=-4)
    assert [item.duration_minutes for item in occurrences] == [240, 240]


def test_nonexistent_spring_forward_local_time_fails_explicitly() -> None:
    rule = weekly_rule(
        day_of_week="sunday",
        start_time=time(2, 30),
        end_time=time(3, 30),
    )

    with pytest.raises(RecurrenceTimeError, match="does not exist"):
        expand_occurrences(rule, date(2026, 3, 8), date(2026, 3, 8))


def test_ambiguous_fall_back_local_time_fails_instead_of_guessing_fold() -> None:
    rule = weekly_rule(
        day_of_week="sunday",
        start_time=time(1, 30),
        end_time=time(2, 30),
    )

    with pytest.raises(RecurrenceTimeError, match="ambiguous"):
        expand_occurrences(rule, date(2026, 11, 1), date(2026, 11, 1))


def test_unknown_timezone_fails_before_date_matching() -> None:
    rule = weekly_rule(timezone="Mars/Olympus_Mons")

    with pytest.raises(RecurrenceTimeError, match="Unknown recurrence timezone"):
        expand_occurrences(rule, date(2026, 8, 1), date(2026, 8, 31))


def test_expansion_limit_supports_six_occurrence_preview() -> None:
    occurrences = expand_occurrences(
        weekly_rule(),
        date(2026, 8, 1),
        date(2026, 12, 31),
        limit=6,
    )

    assert len(occurrences) == 6
    assert occurrences[0].local_date == date(2026, 8, 7)
    assert occurrences[-1].local_date == date(2026, 9, 11)
