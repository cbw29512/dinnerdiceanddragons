"""Shared server-side policy helpers for authenticated onboarding writes."""

import logging
from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.identity.display_names import DisplayName, DisplayNameValidationError, prepare_display_name
from app.models.game_system import GameSystem
from app.models.recurring_availability_rule import RecurringAvailabilityRule
from app.models.user import User
from app.models.user_role import UserRole, UserRoleType
from app.schemas.availability import AvailabilityWindowInput

LOGGER = logging.getLogger(__name__)


class OnboardingValidationError(ValueError):
    """Raised when submitted onboarding state is invalid for DDD policy."""


class OnboardingConflictError(RuntimeError):
    """Raised when valid onboarding input conflicts with durable state."""


class OnboardingPersistenceError(RuntimeError):
    """Raised when onboarding cannot be safely persisted."""


def prepare_available_display_name(
    session: Session,
    user: User,
    value: str,
) -> DisplayName:
    """Prepare a display name and reject an existing owner before mutation."""

    try:
        prepared = prepare_display_name(value)
    except DisplayNameValidationError as exc:
        raise OnboardingValidationError(str(exc)) from exc

    try:
        existing_owner = session.scalar(
            select(User.id).where(User.display_name_normalized == prepared.normalized)
        )
    except SQLAlchemyError:
        LOGGER.exception("Failed to check display-name ownership for user %s", user.id)
        raise

    if existing_owner is not None and existing_owner != user.id:
        raise OnboardingConflictError("That display name is already in use.")
    return prepared


def ensure_user_role(session: Session, user_id: UUID, role: UserRoleType) -> None:
    """Add one DDD application role without disturbing any existing roles."""

    try:
        existing = session.get(UserRole, (user_id, role.value))
        if existing is None:
            session.add(UserRole(user_id=user_id, role=role.value))
    except SQLAlchemyError:
        LOGGER.exception("Failed to ensure role %s for user %s", role.value, user_id)
        raise


def resolve_active_game_systems(
    session: Session,
    slugs: Sequence[str],
) -> dict[str, GameSystem]:
    """Resolve canonical active catalog rows by public slug."""

    try:
        systems = session.scalars(
            select(GameSystem).where(
                GameSystem.slug.in_(slugs),
                GameSystem.active.is_(True),
            )
        ).all()
    except SQLAlchemyError:
        LOGGER.exception("Failed to resolve onboarding GameSystem slugs")
        raise

    by_slug = {system.slug: system for system in systems}
    missing = sorted(set(slugs) - by_slug.keys())
    if missing:
        raise OnboardingValidationError(
            f"Unknown or inactive game system slug(s): {', '.join(missing)}."
        )
    return by_slug


def recurring_rule_from_input(item: AvailabilityWindowInput) -> RecurringAvailabilityRule:
    """Translate already-validated API input into a canonical recurrence row."""

    try:
        return RecurringAvailabilityRule(
            day_of_week=item.day_of_week.value,
            start_time=item.start_time,
            end_time=item.end_time,
            pattern_type=item.pattern_type.value,
            week_interval=item.week_interval,
            anchor_date=item.anchor_date,
            monthly_ordinal=(item.monthly_ordinal.value if item.monthly_ordinal else None),
            month_interval=item.month_interval,
            timezone=item.timezone,
            starts_on=item.starts_on,
            ends_on=item.ends_on,
            active=True,
        )
    except (TypeError, ValueError) as exc:
        LOGGER.exception("Failed to translate validated availability input")
        raise OnboardingValidationError("Availability could not be persisted.") from exc
