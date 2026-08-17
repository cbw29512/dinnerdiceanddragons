"""Pure calendar-date generation for DDD recurring availability rules."""

from calendar import monthrange
from datetime import date, timedelta

from app.models.recurring_availability_rule import RecurringAvailabilityRule

WEEKDAY_INDEX = {
    "monday": 0,
    "tuesday": 1,
    "wednesday": 2,
    "thursday": 3,
    "friday": 4,
    "saturday": 5,
    "sunday": 6,
}
ORDINAL_INDEX = {"first": 1, "second": 2, "third": 3, "fourth": 4}


class RecurrenceRuleError(ValueError):
    """A persisted recurrence rule cannot be expanded deterministically."""


def occurrence_dates(
    rule: RecurringAvailabilityRule,
    window_start: date,
    window_end: date,
    *,
    limit: int | None = None,
) -> list[date]:
    """Expand one rule into actual local dates inside an inclusive search window."""

    if window_start > window_end:
        raise RecurrenceRuleError("Recurrence search start cannot be after its end.")
    if limit is not None and limit < 1:
        raise RecurrenceRuleError("Recurrence occurrence limit must be positive.")
    if not rule.active:
        return []

    lower = max(window_start, rule.starts_on) if rule.starts_on else window_start
    upper = min(window_end, rule.ends_on) if rule.ends_on else window_end
    if lower > upper:
        return []

    if rule.pattern_type == "weekly_interval":
        dates = _weekly_dates(rule, lower, upper)
    elif rule.pattern_type == "monthly_ordinal_weekday":
        dates = _monthly_dates(rule, lower, upper)
    else:
        raise RecurrenceRuleError(f"Unsupported recurrence pattern: {rule.pattern_type}.")
    return dates[:limit] if limit is not None else dates


def _weekly_dates(
    rule: RecurringAvailabilityRule,
    lower: date,
    upper: date,
) -> list[date]:
    target_weekday = _weekday(rule.day_of_week)
    interval = rule.week_interval
    if interval is None or not 1 <= interval <= 4:
        raise RecurrenceRuleError("Weekly recurrence requires a 1-4 week interval.")
    if interval > 1:
        _validate_weekly_anchor(rule, target_weekday)

    first = lower + timedelta(days=(target_weekday - lower.weekday()) % 7)
    dates: list[date] = []
    candidate = first
    while candidate <= upper:
        if interval == 1 or _weeks_from_anchor(candidate, rule.anchor_date) % interval == 0:
            dates.append(candidate)
        candidate += timedelta(days=7)
    return dates


def _monthly_dates(
    rule: RecurringAvailabilityRule,
    lower: date,
    upper: date,
) -> list[date]:
    target_weekday = _weekday(rule.day_of_week)
    interval = rule.month_interval
    if interval is None or not 1 <= interval <= 3:
        raise RecurrenceRuleError("Monthly recurrence requires a 1-3 month interval.")
    if rule.monthly_ordinal not in {*ORDINAL_INDEX, "last"}:
        raise RecurrenceRuleError("Monthly recurrence requires a supported ordinal weekday.")
    if interval > 1:
        _validate_monthly_anchor(rule, target_weekday)

    dates: list[date] = []
    year, month = lower.year, lower.month
    while (year, month) <= (upper.year, upper.month):
        if interval == 1 or _months_from_anchor(year, month, rule.anchor_date) % interval == 0:
            candidate = _ordinal_weekday(
                year,
                month,
                target_weekday,
                rule.monthly_ordinal,
            )
            if lower <= candidate <= upper:
                dates.append(candidate)
        year, month = _next_month(year, month)
    return dates


def _weekday(value: str) -> int:
    try:
        return WEEKDAY_INDEX[value]
    except KeyError as exc:
        raise RecurrenceRuleError(f"Unsupported recurrence weekday: {value}.") from exc


def _validate_weekly_anchor(rule: RecurringAvailabilityRule, target_weekday: int) -> None:
    if rule.anchor_date is None:
        raise RecurrenceRuleError("Alternating weekly recurrence requires an anchor date.")
    if rule.anchor_date.weekday() != target_weekday:
        raise RecurrenceRuleError("Weekly recurrence anchor must fall on the configured weekday.")


def _validate_monthly_anchor(rule: RecurringAvailabilityRule, target_weekday: int) -> None:
    if rule.anchor_date is None:
        raise RecurrenceRuleError("Alternating monthly recurrence requires an anchor date.")
    expected = _ordinal_weekday(
        rule.anchor_date.year,
        rule.anchor_date.month,
        target_weekday,
        rule.monthly_ordinal,
    )
    if rule.anchor_date != expected:
        raise RecurrenceRuleError("Monthly recurrence anchor must be a real configured occurrence.")


def _weeks_from_anchor(candidate: date, anchor: date | None) -> int:
    if anchor is None:
        raise RecurrenceRuleError("Weekly recurrence anchor is missing.")
    return (candidate - anchor).days // 7


def _months_from_anchor(year: int, month: int, anchor: date | None) -> int:
    if anchor is None:
        raise RecurrenceRuleError("Monthly recurrence anchor is missing.")
    return (year - anchor.year) * 12 + month - anchor.month


def _ordinal_weekday(
    year: int,
    month: int,
    target_weekday: int,
    ordinal: str | None,
) -> date:
    if ordinal == "last":
        last_day = date(year, month, monthrange(year, month)[1])
        return last_day - timedelta(days=(last_day.weekday() - target_weekday) % 7)
    if ordinal not in ORDINAL_INDEX:
        raise RecurrenceRuleError("Unsupported monthly ordinal.")
    first_day = date(year, month, 1)
    offset = (target_weekday - first_day.weekday()) % 7
    return first_day + timedelta(days=offset + 7 * (ORDINAL_INDEX[ordinal] - 1))


def _next_month(year: int, month: int) -> tuple[int, int]:
    return (year + 1, 1) if month == 12 else (year, month + 1)
