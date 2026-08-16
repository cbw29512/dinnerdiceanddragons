"""Low-level persistence operations for GM onboarding."""

import logging

from sqlalchemy import delete, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.models.availability_window import GMAvailabilityWindow, PlayerAvailabilityWindow
from app.models.game_system import GameSystem
from app.models.gm_profile import GMProfile
from app.models.gm_system_experience import GMSystemExperience, GMSystemFormat
from app.models.recurring_availability_rule import RecurringAvailabilityRule
from app.models.user import User
from app.schemas.gm_onboarding import GMOnboardingRequest
from app.services.onboarding_common import recurring_rule_from_input

LOGGER = logging.getLogger(__name__)


def optional_text(value: str | None) -> str | None:
    """Store blank optional text as NULL rather than an empty string."""

    try:
        return value if value else None
    except Exception:
        LOGGER.exception("Failed to normalize optional GM onboarding text")
        raise


def upsert_gm_profile(
    session: Session,
    user: User,
    payload: GMOnboardingRequest,
) -> GMProfile:
    """Create or update the one GMProfile owned by the authenticated User."""

    try:
        profile = session.scalar(select(GMProfile).where(GMProfile.user_id == user.id))
        if profile is None:
            profile = GMProfile(user_id=user.id)
            session.add(profile)

        profile.bio = optional_text(payload.bio)
        profile.postal_code = payload.postal_code
        profile.travel_radius_miles = payload.travel_radius_miles
        profile.beginner_friendly = payload.beginner_friendly
        profile.gm_style = payload.gm_style
        session.flush()
        return profile
    except SQLAlchemyError:
        LOGGER.exception("Failed to upsert GMProfile for user %s", user.id)
        raise


def replace_gm_system_experience(
    session: Session,
    profile: GMProfile,
    payload: GMOnboardingRequest,
    systems_by_slug: dict[str, GameSystem],
) -> None:
    """Replace the GM's self-described system experience and supported formats."""

    try:
        session.execute(
            delete(GMSystemExperience).where(GMSystemExperience.gm_profile_id == profile.id)
        )
        for item in payload.systems:
            system = systems_by_slug[item.system_slug]
            experience = GMSystemExperience(
                gm_profile_id=profile.id,
                game_system_id=system.id,
                years_playing=item.years_playing,
                years_gming=item.years_gming,
                comfort_level=item.comfort_level.value,
                preferred_player_experience=item.preferred_player_experience.value,
                experience_notes=optional_text(item.experience_notes),
            )
            session.add(experience)
            session.flush()
            session.add_all(
                [
                    GMSystemFormat(
                        gm_system_experience_id=experience.id,
                        format=format_value.value,
                    )
                    for format_value in item.formats
                ]
            )
    except SQLAlchemyError:
        LOGGER.exception("Failed to replace GM system experience for %s", profile.id)
        raise


def replace_gm_availability(
    session: Session,
    profile: GMProfile,
    payload: GMOnboardingRequest,
) -> None:
    """Replace typed GM windows and remove superseded unshared rules."""

    try:
        old_rule_ids = list(
            session.scalars(
                select(GMAvailabilityWindow.recurring_rule_id).where(
                    GMAvailabilityWindow.gm_profile_id == profile.id
                )
            ).all()
        )
        session.execute(
            delete(GMAvailabilityWindow).where(GMAvailabilityWindow.gm_profile_id == profile.id)
        )

        if old_rule_ids:
            player_shared_rule_ids = set(
                session.scalars(
                    select(PlayerAvailabilityWindow.recurring_rule_id).where(
                        PlayerAvailabilityWindow.recurring_rule_id.in_(old_rule_ids)
                    )
                ).all()
            )
            removable_rule_ids = set(old_rule_ids) - player_shared_rule_ids
            if removable_rule_ids:
                session.execute(
                    delete(RecurringAvailabilityRule).where(
                        RecurringAvailabilityRule.id.in_(removable_rule_ids)
                    )
                )

        for item in payload.availability:
            rule = recurring_rule_from_input(item)
            session.add(rule)
            session.flush()
            session.add(
                GMAvailabilityWindow(
                    gm_profile_id=profile.id,
                    recurring_rule_id=rule.id,
                    active=True,
                )
            )
    except SQLAlchemyError:
        LOGGER.exception("Failed to replace GM availability for %s", profile.id)
        raise
