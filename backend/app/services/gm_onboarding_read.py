"""Owner-scoped readback for persisted GM onboarding state."""

import logging
from collections import defaultdict

from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.models.availability_window import GMAvailabilityWindow
from app.models.game_system import GameSystem
from app.models.gm_profile import GMProfile
from app.models.gm_system_experience import GMSystemExperience, GMSystemFormat
from app.models.recurring_availability_rule import RecurringAvailabilityRule
from app.models.user import User
from app.schemas.availability import AvailabilityWindowInput
from app.schemas.gm_onboarding import GMSystemExperienceInput
from app.schemas.onboarding_state import GMOnboardingState

LOGGER = logging.getLogger(__name__)


class GMOnboardingStateNotFoundError(LookupError):
    """Raised when the authenticated User has no persisted GM onboarding."""


def load_gm_onboarding(session: Session, user: User) -> GMOnboardingState:
    """Return the caller's canonical persisted GM onboarding state."""

    try:
        profile = session.scalar(select(GMProfile).where(GMProfile.user_id == user.id))
        if profile is None:
            raise GMOnboardingStateNotFoundError("GM onboarding has not been created.")

        experiences = session.execute(
            select(GMSystemExperience, GameSystem.slug)
            .join(GameSystem, GameSystem.id == GMSystemExperience.game_system_id)
            .where(GMSystemExperience.gm_profile_id == profile.id)
            .order_by(GameSystem.slug)
        ).all()
        experience_ids = [experience.id for experience, _ in experiences]
        formats_by_experience: dict[object, list[str]] = defaultdict(list)
        if experience_ids:
            format_rows = session.execute(
                select(GMSystemFormat.gm_system_experience_id, GMSystemFormat.format)
                .where(GMSystemFormat.gm_system_experience_id.in_(experience_ids))
                .order_by(GMSystemFormat.gm_system_experience_id, GMSystemFormat.format)
            ).all()
            for experience_id, format_value in format_rows:
                formats_by_experience[experience_id].append(format_value)

        rules = session.scalars(
            select(RecurringAvailabilityRule)
            .join(
                GMAvailabilityWindow,
                GMAvailabilityWindow.recurring_rule_id == RecurringAvailabilityRule.id,
            )
            .where(
                GMAvailabilityWindow.gm_profile_id == profile.id,
                GMAvailabilityWindow.active.is_(True),
            )
            .order_by(RecurringAvailabilityRule.created_at, RecurringAvailabilityRule.id)
        ).all()

        return GMOnboardingState(
            display_name=user.display_name or "",
            bio=profile.bio,
            postal_code=profile.postal_code,
            travel_radius_miles=profile.travel_radius_miles,
            beginner_friendly=profile.beginner_friendly,
            gm_style=profile.gm_style,
            systems=[
                GMSystemExperienceInput(
                    system_slug=slug,
                    years_playing=experience.years_playing,
                    years_gming=experience.years_gming,
                    comfort_level=experience.comfort_level,
                    preferred_player_experience=experience.preferred_player_experience,
                    formats=formats_by_experience[experience.id],
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
    except GMOnboardingStateNotFoundError:
        raise
    except (SQLAlchemyError, ValidationError) as exc:
        LOGGER.exception("Failed to load GM onboarding for user %s", user.id)
        raise RuntimeError("GM onboarding could not be loaded.") from exc
