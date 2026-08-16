"""Transactional persistence for authenticated Player onboarding."""

import logging
from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.models.availability_window import PlayerAvailabilityWindow
from app.models.player_profile import PlayerProfile
from app.models.player_system_experience import PlayerSystemExperience
from app.models.user import User
from app.models.user_role import UserRoleType
from app.schemas.player_onboarding import PlayerOnboardingRequest
from app.services.onboarding_common import (
    OnboardingConflictError,
    OnboardingPersistenceError,
    OnboardingValidationError,
    ensure_user_role,
    prepare_available_display_name,
    recurring_rule_from_input,
    resolve_active_game_systems,
)

LOGGER = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class PlayerOnboardingResult:
    """Safe service result returned after one successful commit."""

    player_profile_id: UUID
    display_name: str
    system_slugs: list[str]
    availability_count: int


def _optional_text(value: str | None) -> str | None:
    return value if value else None


def _upsert_profile(
    session: Session,
    user: User,
    payload: PlayerOnboardingRequest,
) -> PlayerProfile:
    profile = session.scalar(select(PlayerProfile).where(PlayerProfile.user_id == user.id))
    if profile is None:
        profile = PlayerProfile(user_id=user.id)
        session.add(profile)

    profile.bio = _optional_text(payload.bio)
    profile.postal_code = payload.postal_code
    profile.travel_radius_miles = payload.travel_radius_miles
    profile.preferred_format = payload.preferred_format.value
    profile.willing_to_learn_new_system = payload.willing_to_learn_new_system
    profile.environment_preferences = list(payload.environment_preferences)
    profile.accessibility_notes_private = _optional_text(payload.accessibility_notes_private)
    session.flush()
    return profile


def _replace_system_experience(
    session: Session,
    profile: PlayerProfile,
    payload: PlayerOnboardingRequest,
    systems_by_slug,
) -> None:
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
                experience_notes=_optional_text(item.experience_notes),
            )
        )


def _replace_availability(
    session: Session,
    profile: PlayerProfile,
    payload: PlayerOnboardingRequest,
) -> None:
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


def save_player_onboarding(
    session: Session,
    user: User,
    payload: PlayerOnboardingRequest,
) -> PlayerOnboardingResult:
    """Replace one authenticated user's Player onboarding state atomically."""

    try:
        prepared_name = prepare_available_display_name(session, user, payload.display_name)
        systems_by_slug = resolve_active_game_systems(
            session,
            [item.system_slug for item in payload.systems],
        )

        user.display_name = prepared_name.display
        user.display_name_normalized = prepared_name.normalized
        ensure_user_role(session, user.id, UserRoleType.PLAYER)
        profile = _upsert_profile(session, user, payload)
        _replace_system_experience(session, profile, payload, systems_by_slug)
        _replace_availability(session, profile, payload)
        session.commit()

        LOGGER.info(
            "Saved Player onboarding for user %s with %s systems and %s windows",
            user.id,
            len(payload.systems),
            len(payload.availability),
        )
        return PlayerOnboardingResult(
            player_profile_id=profile.id,
            display_name=prepared_name.display,
            system_slugs=[item.system_slug for item in payload.systems],
            availability_count=len(payload.availability),
        )
    except (OnboardingValidationError, OnboardingConflictError):
        session.rollback()
        raise
    except IntegrityError as exc:
        session.rollback()
        LOGGER.warning("Player onboarding conflict for user %s", user.id, exc_info=True)
        raise OnboardingConflictError(
            "Player onboarding conflicts with existing account data."
        ) from exc
    except SQLAlchemyError as exc:
        session.rollback()
        LOGGER.exception("Player onboarding database failure for user %s", user.id)
        raise OnboardingPersistenceError("Player onboarding could not be saved.") from exc
    except Exception as exc:
        session.rollback()
        LOGGER.exception("Unexpected Player onboarding failure for user %s", user.id)
        raise OnboardingPersistenceError("Player onboarding could not be saved.") from exc
