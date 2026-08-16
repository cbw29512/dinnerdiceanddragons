"""Timezone-aware recurrence expansion used by production hard-fit matching."""

from dataclasses import dataclass
from datetime import UTC, date, datetime, time
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from app.models.recurring_availability_rule import RecurringAvailabilityRule
from app.services.recurrence_dates import RecurrenceRuleError, occurrence_dates


class RecurrenceTimeError(ValueError):
    """A generated local recurrence time is ambiguous or nonexistent."""


@dataclass(frozen=True, slots=True)
class OccurrenceWindow:
    """One actual timezone-aware occurrence generated from a recurring rule."""

    local_date: date
    start_at: datetime
    end_at: datetime
    timezone: str

    @property
    def duration_minutes(self) -> int:
        """Return the real elapsed duration, including any DST offset change."""

        return int(
            (self.end_at.astimezone(UTC) - self.start_at.astimezone(UTC)).total_seconds() / 60
        )


def expand_occurrences(
    rule: RecurringAvailabilityRule,
    window_start: date,
    window_end: date,
    *,
    limit: int | None = None,
) -> list[OccurrenceWindow]:
    """Expand a recurrence into deterministic timezone-aware occurrence windows."""

    try:
        zone = ZoneInfo(rule.timezone)
    except (ZoneInfoNotFoundError, ValueError) as exc:
        raise RecurrenceTimeError(f"Unknown recurrence timezone: {rule.timezone}.") from exc

    dates = occurrence_dates(rule, window_start, window_end, limit=limit)
    windows: list[OccurrenceWindow] = []
    for local_date in dates:
        start_at = _strict_local_datetime(local_date, rule.start_time, zone)
        end_at = _strict_local_datetime(local_date, rule.end_time, zone)
        if end_at.astimezone(UTC) <= start_at.astimezone(UTC):
            raise RecurrenceTimeError(
                f"Recurrence occurrence on {local_date.isoformat()} has non-positive elapsed duration."
            )
        windows.append(
            OccurrenceWindow(
                local_date=local_date,
                start_at=start_at,
                end_at=end_at,
                timezone=rule.timezone,
            )
        )
    return windows


def _strict_local_datetime(local_date: date, local_time: time, zone: ZoneInfo) -> datetime:
    """Localize one wall-clock value without silently guessing a DST fold or gap."""

    naive = datetime.combine(local_date, local_time)
    fold_zero = naive.replace(tzinfo=zone, fold=0)
    fold_one = naive.replace(tzinfo=zone, fold=1)
    valid_zero = _round_trips(fold_zero, naive, zone)
    valid_one = _round_trips(fold_one, naive, zone)

    if not valid_zero and not valid_one:
        raise RecurrenceTimeError(
            f"Local time {naive.isoformat()} does not exist in timezone {zone.key}."
        )
    if valid_zero and valid_one and fold_zero.utcoffset() != fold_one.utcoffset():
        raise RecurrenceTimeError(
            f"Local time {naive.isoformat()} is ambiguous in timezone {zone.key}."
        )
    if valid_zero:
        return fold_zero
    return fold_one


def _round_trips(candidate: datetime, naive: datetime, zone: ZoneInfo) -> bool:
    round_trip = candidate.astimezone(UTC).astimezone(zone)
    return round_trip.replace(tzinfo=None) == naive


__all__ = [
    "OccurrenceWindow",
    "RecurrenceRuleError",
    "RecurrenceTimeError",
    "expand_occurrences",
]
