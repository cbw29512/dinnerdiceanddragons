"""Persistence tests for recurring availability rules."""

from datetime import date, time
from uuid import uuid4

import pytest
from sqlalchemy import create_engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import metadata
from app.models.recurring_availability_rule import (
    AvailabilityDay,
    AvailabilityOwnerType,
    AvailabilityPatternType,
    MonthlyOrdinal,
    RecurringAvailabilityRule,
)


def make_session() -> Session:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    metadata.create_all(engine)
    return Session(engine)


def make_weekly_rule(**overrides: object) -> RecurringAvailabilityRule:
    values: dict[str, object] = {
        "owner_type": AvailabilityOwnerType.PLAYER.value,
        "owner_id": uuid4(),
        "day_of_week": AvailabilityDay.SATURDAY.value,
        "start_time": time(18, 0),
        "end_time": time(22, 0),
        "pattern_type": AvailabilityPatternType.WEEKLY_INTERVAL.value,
        "week_interval": 1,
        "timezone": "America/New_York",
    }
    values.update(overrides)
    return RecurringAvailabilityRule(**values)


def test_weekly_and_monthly_rules_round_trip() -> None:
    with make_session() as session:
        weekly = make_weekly_rule()
        monthly = RecurringAvailabilityRule(
            owner_type=AvailabilityOwnerType.VENUE.value,
            owner_id=uuid4(),
            day_of_week=AvailabilityDay.WEDNESDAY.value,
            start_time=time(17, 30),
            end_time=time(21, 30),
            pattern_type=AvailabilityPatternType.MONTHLY_ORDINAL_WEEKDAY.value,
            monthly_ordinal=MonthlyOrdinal.LAST.value,
            month_interval=2,
            anchor_date=date(2026, 8, 1),
            timezone="America/New_York",
            starts_on=date(2026, 8, 1),
        )
        session.add_all([weekly, monthly])
        session.commit()
        stored_weekly = session.get(RecurringAvailabilityRule, weekly.id)
        stored_monthly = session.get(RecurringAvailabilityRule, monthly.id)
        assert stored_weekly is not None
        assert stored_weekly.active is True
        assert stored_monthly is not None
        assert stored_monthly.monthly_ordinal == "last"
        assert stored_monthly.month_interval == 2


@pytest.mark.parametrize(
    "overrides",
    [
        {"owner_type": "spectator"},
        {"day_of_week": "funday"},
        {"pattern_type": "sometimes"},
        {"timezone": "   "},
        {"start_time": time(22, 0), "end_time": time(18, 0)},
        {"starts_on": date(2026, 9, 1), "ends_on": date(2026, 8, 1)},
    ],
)
def test_invalid_common_fields_are_rejected(overrides: dict[str, object]) -> None:
    with make_session() as session:
        session.add(make_weekly_rule(**overrides))
        with pytest.raises(IntegrityError):
            session.commit()


@pytest.mark.parametrize(
    "overrides",
    [
        {"week_interval": None},
        {"week_interval": 0},
        {"week_interval": 5},
        {"week_interval": 2, "anchor_date": None},
        {"monthly_ordinal": MonthlyOrdinal.FIRST.value},
        {"month_interval": 1},
    ],
)
def test_invalid_weekly_fields_are_rejected(overrides: dict[str, object]) -> None:
    with make_session() as session:
        session.add(make_weekly_rule(**overrides))
        with pytest.raises(IntegrityError):
            session.commit()


def test_alternating_weekly_rule_accepts_anchor_date() -> None:
    with make_session() as session:
        rule = make_weekly_rule(
            owner_type=AvailabilityOwnerType.GM.value,
            week_interval=2,
            anchor_date=date(2026, 8, 15),
        )
        session.add(rule)
        session.commit()
        assert rule.anchor_date == date(2026, 8, 15)


@pytest.mark.parametrize(
    ("month_interval", "ordinal", "anchor_date"),
    [
        (None, MonthlyOrdinal.FIRST.value, None),
        (1, None, None),
        (4, MonthlyOrdinal.FIRST.value, date(2026, 8, 1)),
        (2, MonthlyOrdinal.FIRST.value, None),
    ],
)
def test_invalid_monthly_fields_are_rejected(
    month_interval: int | None,
    ordinal: str | None,
    anchor_date: date | None,
) -> None:
    with make_session() as session:
        rule = RecurringAvailabilityRule(
            owner_type=AvailabilityOwnerType.VENUE.value,
            owner_id=uuid4(),
            day_of_week=AvailabilityDay.MONDAY.value,
            start_time=time(18, 0),
            end_time=time(21, 0),
            pattern_type=AvailabilityPatternType.MONTHLY_ORDINAL_WEEKDAY.value,
            monthly_ordinal=ordinal,
            month_interval=month_interval,
            anchor_date=anchor_date,
            timezone="America/New_York",
        )
        session.add(rule)
        with pytest.raises(IntegrityError):
            session.commit()
