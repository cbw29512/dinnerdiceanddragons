"""Low-level persistence operations for Player onboarding."""

import logging

from sqlalchemy import delete, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.models.availability_window import PlayerAvailabilityWindow
from app.models.game_system import GameSystem
from app.models.player_profile import PlayerProfile
from app.models.player_system_experience import PlayerSystemExperience
from app.models.user import User
from app.schemas.player_onboarding import PlayerOnboardingRequest
from app.services.onboarding_common import recurring_rule_from_input

LOGGER = logging.getLogger(__name__)


def optional_text(value: str | None) -> str | None:
    """Store blank optional text as NULL rather than an empty string."""

    try:
        return value if value else None
    except Exception:
        LOGGER.exception("Failed to normalize optional Player onboarding text")
        raise


def upsert_player_profile(
    session: Session,
    user: User,
    payload: PlayerOnboardingRequest,
) -> PlayerProfile:
    """Create or update the one PlayerProfile owned by the authenticated User."""

    try:
        profile = session.scalar(select(PlayerProfile).where(PlayerProfile.user_id == user.id))
        if profile is None:
            profile = PlayerProfile(user_id=user.id)
            session.add(profile)

        profile.bio = optional_text(payload.bio)
        profile.postal_code = payload.postal_code
        profile.travel_radius_miles = payload.travel_radius_miles
        profile.preferred_format = payload.preferred_format.value
        profile.willing_to_learn_new_system = payload.willing_to_learn_new_system
        profile.environment_preferences = list(payload.environment_preferences)
        profile.accessibility_notes_private = optional_text(payload.accessibility_notes_private)
        session.flush()
        return profile
    except SQLAlchemyError:
        LOGGER.exception("Failed to upsert PlayerProfile for user %s", user.id)
        raise


def replace_player_system_experience(
    session: Session,
    profile: PlayerProfile,
    payload: PlayerOnboardingRequest,
    systems_by_slug: dict[str, GameSystem],
) -> None:
    """Replace the Player's self-described system-experience set."""

    try:
        session.execute(
            delete(PlayerSystemExperience).where(
                PlayerSystemExperience.player_profile_id == profile.id
            )
        )
        for item in payload.systems:
            system = systems_by_slug[item.system_slug]
            session.add(
                PlayerSystemExperience(
                    player_profile_id=profile.id,
                    game_system_id=system.id,
                    years_playing=item.years_playing,
                    comfort_level=item.comfort_level.value,
                    experience_notes=optional_text(item.experience_notes),
                )
            )
    except SQLAlchemyError:
        LOGGER.exception("Failed to replace Player system experience for %s", profile.id)
        raise


def replace_player_availability(
    session: Session,
    profile: PlayerProfile,
    payload: PlayerOnboardingRequest,
) -> None:
    """Replace typed Player windows without deleting owner-neutral rule rows."""

    try:
        session.execute(
            delete(PlayerAvailabilityWindow).where(
                PlayerAvailabilityWindow.player_profile_id == profile.id
            )
        )
        for item in payload.availability:
            rule = recurring_rule_from_input(item)
            session.add(rule)
            session.flush()
            session.add(
                PlayerAvailabilityWindow(
                    player_profile_id=profile.id,
                    recurring_rule_id=rule.id,
                    active=True,
                )
            )
    except SQLAlchemyError:
        LOGGER.exception("Failed to replace Player availability for %s", profile.id)
        raise
