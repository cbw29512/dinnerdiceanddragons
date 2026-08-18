"""Shared persistence/read helpers for signal-specific matching availability."""

import logging
from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.matching_signal_availability import (
    GMSupplyAvailabilityWindow,
    PlayerDemandAvailabilityWindow,
)
from app.models.recurring_availability_rule import RecurringAvailabilityRule
from app.schemas.availability import AvailabilityWindowInput
from app.services.matching_signal_common import MatchingSignalValidationError
from app.services.onboarding_common import OnboardingValidationError, recurring_rule_from_input

LOGGER = logging.getLogger(__name__)


def availability_input_from_rule(rule: RecurringAvailabilityRule) -> AvailabilityWindowInput:
    """Translate persisted recurrence data back into the public validated contract."""

    return AvailabilityWindowInput(
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
    )


def add_player_demand_availability(
    session: Session,
    signal_id: UUID,
    availability: Sequence[AvailabilityWindowInput],
) -> None:
    """Persist validated recurring windows owned by one Player demand signal."""

    _require_availability(availability)
    try:
        for item in availability:
            rule = recurring_rule_from_input(item)
            session.add(rule)
            session.flush()
            session.add(
                PlayerDemandAvailabilityWindow(
                    player_demand_signal_id=signal_id,
                    recurring_rule_id=rule.id,
                    active=True,
                )
            )
    except OnboardingValidationError as exc:
        raise MatchingSignalValidationError(str(exc)) from exc


def add_gm_supply_availability(
    session: Session,
    signal_id: UUID,
    availability: Sequence[AvailabilityWindowInput],
) -> None:
    """Persist validated recurring windows owned by one GM supply signal."""

    _require_availability(availability)
    try:
        for item in availability:
            rule = recurring_rule_from_input(item)
            session.add(rule)
            session.flush()
            session.add(
                GMSupplyAvailabilityWindow(
                    gm_supply_signal_id=signal_id,
                    recurring_rule_id=rule.id,
                    active=True,
                )
            )
    except OnboardingValidationError as exc:
        raise MatchingSignalValidationError(str(exc)) from exc


def player_demand_availability(
    session: Session,
    signal_id: UUID,
) -> list[AvailabilityWindowInput]:
    """Return active signal-owned windows in deterministic order."""

    rules = session.scalars(
        select(RecurringAvailabilityRule)
        .join(
            PlayerDemandAvailabilityWindow,
            PlayerDemandAvailabilityWindow.recurring_rule_id == RecurringAvailabilityRule.id,
        )
        .where(
            PlayerDemandAvailabilityWindow.player_demand_signal_id == signal_id,
            PlayerDemandAvailabilityWindow.active.is_(True),
            RecurringAvailabilityRule.active.is_(True),
        )
        .order_by(RecurringAvailabilityRule.id)
    ).all()
    return [availability_input_from_rule(rule) for rule in rules]


def gm_supply_availability(
    session: Session,
    signal_id: UUID,
) -> list[AvailabilityWindowInput]:
    """Return active signal-owned windows in deterministic order."""

    rules = session.scalars(
        select(RecurringAvailabilityRule)
        .join(
            GMSupplyAvailabilityWindow,
            GMSupplyAvailabilityWindow.recurring_rule_id == RecurringAvailabilityRule.id,
        )
        .where(
            GMSupplyAvailabilityWindow.gm_supply_signal_id == signal_id,
            GMSupplyAvailabilityWindow.active.is_(True),
            RecurringAvailabilityRule.active.is_(True),
        )
        .order_by(RecurringAvailabilityRule.id)
    ).all()
    return [availability_input_from_rule(rule) for rule in rules]


def _require_availability(availability: Sequence[AvailabilityWindowInput]) -> None:
    if not availability:
        raise MatchingSignalValidationError(
            "At least one availability window is required for a matching signal."
        )


__all__ = [
    "add_gm_supply_availability",
    "add_player_demand_availability",
    "availability_input_from_rule",
    "gm_supply_availability",
    "player_demand_availability",
]
