"""Owner-scoped readback for persisted Player onboarding state."""

import logging

from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.models.availability_window import PlayerAvailabilityWindow
from app.models.game_system import GameSystem
from app.models.player_profile import PlayerProfile
from app.models.player_system_experience import PlayerSystemExperience
from app.models.recurring_availability_rule import RecurringAvailabilityRule
from app.models.user import User
from app.schemas.availability import AvailabilityWindowInput
from app.schemas.onboarding_state import PlayerOnboardingState
from app.schemas.player_onboarding import PlayerSystemExperienceInput

LOGGER = logging.getLogger(__name__)


class PlayerOnboardingStateNotFoundError(LookupError):
    """Raised when the authenticated User has no persisted Player onboarding."""


def load_player_onboarding(session: Session, user: User) -> PlayerOnboardingState:
    """Return the caller's canonical persisted Player onboarding state."""

    try:
        profile = session.scalar(select(PlayerProfile).where(PlayerProfile.user_id == user.id))
        if profile is None:
            raise PlayerOnboardingStateNotFoundError("Player onboarding has not been created.")

        experiences = session.execute(
            select(PlayerSystemExperience, GameSystem.slug)
            .join(GameSystem, GameSystem.id == PlayerSystemExperience.game_system_id)
            .where(PlayerSystemExperience.player_profile_id == profile.id)
            .order_by(GameSystem.slug)
        ).all()
        rules = session.scalars(
            select(RecurringAvailabilityRule)
            .join(
                PlayerAvailabilityWindow,
                PlayerAvailabilityWindow.recurring_rule_id == RecurringAvailabilityRule.id,
            )
            .where(
                PlayerAvailabilityWindow.player_profile_id == profile.id,
                PlayerAvailabilityWindow.active.is_(True),
            )
            .order_by(RecurringAvailabilityRule.created_at, RecurringAvailabilityRule.id)
        ).all()

        return PlayerOnboardingState(
            display_name=user.display_name or "",
            bio=profile.bio,
            postal_code=profile.postal_code,
            travel_radius_miles=profile.travel_radius_miles,
            preferred_format=profile.preferred_format,
            willing_to_learn_new_system=profile.willing_to_learn_new_system,
            environment_preferences=list(profile.environment_preferences or []),
            accessibility_notes_private=profile.accessibility_notes_private,
            systems=[
                PlayerSystemExperienceInput(
                    system_slug=slug,
                    years_playing=experience.years_playing,
                    comfort_level=experience.comfort_level,
                    experience_notes=experience.experience_notes,
                )
                for experience, slug in experiences
            ],
            availability=[
                AvailabilityWindowInput(
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
                for rule in rules
            ],
        )
    except PlayerOnboardingStateNotFoundError:
        raise
    except (SQLAlchemyError, ValidationError) as exc:
        LOGGER.exception("Failed to load Player onboarding for user %s", user.id)
        raise RuntimeError("Player onboarding could not be loaded.") from exc
