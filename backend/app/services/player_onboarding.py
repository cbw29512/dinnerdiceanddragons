"""Transaction orchestration for authenticated Player onboarding."""

import logging
from dataclasses import dataclass
from uuid import UUID

from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.user_role import UserRoleType
from app.schemas.player_onboarding import PlayerOnboardingRequest
from app.services.onboarding_common import (
    OnboardingConflictError,
    OnboardingPersistenceError,
    OnboardingValidationError,
    ensure_user_role,
    prepare_available_display_name,
    resolve_active_game_systems,
)
from app.services.player_onboarding_persistence import (
    replace_player_availability,
    replace_player_system_experience,
    upsert_player_profile,
)

LOGGER = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class PlayerOnboardingResult:
    """Safe service result returned after one successful commit."""

    player_profile_id: UUID
    display_name: str
    system_slugs: list[str]
    availability_count: int


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
        profile = upsert_player_profile(session, user, payload)
        replace_player_system_experience(session, profile, payload, systems_by_slug)
        replace_player_availability(session, profile, payload)
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
