"""Calendar-date tests for production recurrence expansion."""

from datetime import date, time

import pytest

from app.models.recurring_availability_rule import RecurringAvailabilityRule
from app.services.recurrence_dates import RecurrenceRuleError, occurrence_dates


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


def monthly_rule(**overrides) -> RecurringAvailabilityRule:
    values = {
        "day_of_week": "saturday",
        "start_time": time(18, 0),
        "end_time": time(22, 0),
        "pattern_type": "monthly_ordinal_weekday",
        "monthly_ordinal": "last",
        "month_interval": 1,
        "timezone": "America/New_York",
        "active": True,
    }
    values.update(overrides)
    return RecurringAvailabilityRule(**values)


def test_weekly_rule_expands_actual_weekday_dates() -> None:
    dates = occurrence_dates(
        weekly_rule(),
        date(2026, 8, 1),
        date(2026, 8, 31),
    )

    assert dates == [
        date(2026, 8, 7),
        date(2026, 8, 14),
        date(2026, 8, 21),
        date(2026, 8, 28),
    ]


def test_every_other_week_uses_real_anchor_cycle() -> None:
    dates = occurrence_dates(
        weekly_rule(week_interval=2, anchor_date=date(2026, 8, 7)),
        date(2026, 8, 1),
        date(2026, 9, 4),
    )

    assert dates == [date(2026, 8, 7), date(2026, 8, 21), date(2026, 9, 4)]


def test_weekly_anchor_must_match_configured_weekday() -> None:
    rule = weekly_rule(week_interval=2, anchor_date=date(2026, 8, 8))

    with pytest.raises(RecurrenceRuleError, match="configured weekday"):
        occurrence_dates(rule, date(2026, 8, 1), date(2026, 8, 31))


def test_last_saturday_expands_across_months() -> None:
    dates = occurrence_dates(
        monthly_rule(),
        date(2026, 8, 1),
        date(2026, 11, 30),
    )

    assert dates == [
        date(2026, 8, 29),
        date(2026, 9, 26),
        date(2026, 10, 31),
        date(2026, 11, 28),
    ]


def test_second_sunday_every_two_months_uses_anchor_month_cycle() -> None:
    rule = monthly_rule(
        day_of_week="sunday",
        monthly_ordinal="second",
        month_interval=2,
        anchor_date=date(2026, 1, 11),
    )

    dates = occurrence_dates(rule, date(2026, 1, 1), date(2026, 6, 30))

    assert dates == [date(2026, 1, 11), date(2026, 3, 8), date(2026, 5, 10)]


def test_monthly_anchor_must_be_real_configured_occurrence() -> None:
    rule = monthly_rule(
        day_of_week="sunday",
        monthly_ordinal="second",
        month_interval=2,
        anchor_date=date(2026, 1, 18),
    )

    with pytest.raises(RecurrenceRuleError, match="real configured occurrence"):
        occurrence_dates(rule, date(2026, 1, 1), date(2026, 6, 30))


def test_rule_date_bounds_clip_search_window() -> None:
    rule = weekly_rule(starts_on=date(2026, 8, 14), ends_on=date(2026, 8, 21))

    dates = occurrence_dates(rule, date(2026, 8, 1), date(2026, 8, 31))

    assert dates == [date(2026, 8, 14), date(2026, 8, 21)]


def test_limit_returns_only_requested_preview_count() -> None:
    dates = occurrence_dates(
        weekly_rule(),
        date(2026, 8, 1),
        date(2026, 12, 31),
        limit=6,
    )

    assert len(dates) == 6
    assert dates[-1] == date(2026, 9, 11)


def test_inactive_rule_has_no_occurrences() -> None:
    assert (
        occurrence_dates(
            weekly_rule(active=False),
            date(2026, 8, 1),
            date(2026, 8, 31),
        )
        == []
    )
