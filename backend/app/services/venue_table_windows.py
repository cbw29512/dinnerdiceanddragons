"""Verified Venue Manager table-window creation and owner listing."""

import logging
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.models.recurring_availability_rule import RecurringAvailabilityRule
from app.models.user import User
from app.models.venue_table_window import VenueTableWindow
from app.schemas.availability import AvailabilityWindowInput
from app.schemas.matching_signals import (
    VenueTableWindowCreate,
    VenueTableWindowResponse,
)
from app.services.matching_signal_common import (
    MatchingSignalConflictError,
    MatchingSignalPersistenceError,
    MatchingSignalValidationError,
    require_verified_venue_manager,
)
from app.services.onboarding_common import recurring_rule_from_input
from app.services.query_limits import MAX_OWNER_MATCHING_SIGNAL_ITEMS

LOGGER = logging.getLogger(__name__)


def _availability(rule: RecurringAvailabilityRule) -> AvailabilityWindowInput:
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


def _response(
    window: VenueTableWindow,
    rule: RecurringAvailabilityRule,
) -> VenueTableWindowResponse:
    return VenueTableWindowResponse(
        id=window.id,
        venue_id=window.venue_id,
        active=window.active,
        availability=_availability(rule),
        table_count=window.table_count,
        max_people_per_table=window.max_people_per_table,
        purchase_policy=window.purchase_policy,
        approval_required=window.approval_required,
        environment_notes=window.environment_notes,
    )


def create_venue_table_window(
    session: Session,
    user: User,
    venue_id: UUID,
    payload: VenueTableWindowCreate,
) -> VenueTableWindowResponse:
    """Persist one table-capacity window for a verified managed Venue."""

    try:
        require_verified_venue_manager(session, user, venue_id)
        rule = recurring_rule_from_input(payload.availability)
        session.add(rule)
        session.flush()
        window = VenueTableWindow(
            venue_id=venue_id,
            recurring_rule_id=rule.id,
            table_count=payload.table_count,
            max_people_per_table=payload.max_people_per_table,
            purchase_policy=payload.purchase_policy or None,
            approval_required=payload.approval_required,
            environment_notes=payload.environment_notes or None,
            active=True,
        )
        session.add(window)
        session.commit()
        LOGGER.info("Created VenueTableWindow %s for venue %s", window.id, venue_id)
        return _response(window, rule)
    except (MatchingSignalValidationError, MatchingSignalConflictError, HTTPException):
        session.rollback()
        raise
    except IntegrityError as exc:
        session.rollback()
        LOGGER.warning("Venue table-window conflict for venue %s", venue_id, exc_info=True)
        raise MatchingSignalConflictError(
            "Venue table window conflicts with existing data."
        ) from exc
    except SQLAlchemyError as exc:
        session.rollback()
        LOGGER.exception("Venue table-window database failure for venue %s", venue_id)
        raise MatchingSignalPersistenceError("Venue table window could not be saved.") from exc
    except Exception as exc:
        session.rollback()
        LOGGER.exception("Unexpected Venue table-window failure for venue %s", venue_id)
        raise MatchingSignalPersistenceError("Venue table window could not be saved.") from exc


def list_venue_table_windows(
    session: Session,
    user: User,
    venue_id: UUID,
) -> list[VenueTableWindowResponse]:
    """Return a bounded list of table windows for a verified Venue Manager."""

    try:
        require_verified_venue_manager(session, user, venue_id)
        rows = session.execute(
            select(VenueTableWindow, RecurringAvailabilityRule)
            .join(
                RecurringAvailabilityRule,
                RecurringAvailabilityRule.id == VenueTableWindow.recurring_rule_id,
            )
            .where(VenueTableWindow.venue_id == venue_id)
            .order_by(VenueTableWindow.active.desc(), VenueTableWindow.id)
            .limit(MAX_OWNER_MATCHING_SIGNAL_ITEMS)
        ).all()
        return [_response(window, rule) for window, rule in rows]
    except (MatchingSignalValidationError, MatchingSignalConflictError, HTTPException):
        raise
    except SQLAlchemyError as exc:
        LOGGER.exception("Failed to list Venue table windows for venue %s", venue_id)
        raise MatchingSignalPersistenceError("Venue table windows could not be loaded.") from exc
