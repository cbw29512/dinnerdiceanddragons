"""Shared detachment helpers for production Table Match candidate loaders."""

import logging
from collections.abc import Sequence

from app.models.recurring_availability_rule import RecurringAvailabilityRule
from app.services.table_match_engine_policy import (
    MAX_MATCH_CANDIDATE_ROWS_PER_KIND,
    TableMatchCapacityError,
)

LOGGER = logging.getLogger(__name__)


def require_bounded_candidate_rows[RowT](
    rows: Sequence[RowT],
    *,
    kind: str,
) -> Sequence[RowT]:
    """Reject rather than silently truncate a matcher candidate class."""

    try:
        if len(rows) > MAX_MATCH_CANDIDATE_ROWS_PER_KIND:
            raise TableMatchCapacityError(
                f"Table Match {kind} candidate set exceeds safe loading capacity."
            )
        return rows
    except TableMatchCapacityError:
        raise
    except Exception:
        LOGGER.exception("Failed to validate %s candidate row capacity", kind)
        raise


def copy_recurring_rule(rule: RecurringAvailabilityRule) -> RecurringAvailabilityRule:
    """Detach the recurrence fields needed after the read transaction closes."""

    try:
        return RecurringAvailabilityRule(
            id=rule.id,
            day_of_week=rule.day_of_week,
            start_time=rule.start_time,
            end_time=rule.end_time,
            pattern_type=rule.pattern_type,
            week_interval=rule.week_interval,
            anchor_date=rule.anchor_date,
            monthly_ordinal=rule.monthly_ordinal,
            month_interval=rule.month_interval,
            timezone=rule.timezone,
            starts_on=rule.starts_on,
            ends_on=rule.ends_on,
            active=rule.active,
        )
    except Exception:
        LOGGER.exception("Failed to detach recurring availability rule")
        raise


__all__ = ["copy_recurring_rule", "require_bounded_candidate_rows"]
