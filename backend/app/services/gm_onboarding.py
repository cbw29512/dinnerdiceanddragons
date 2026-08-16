"""Transaction orchestration for authenticated GM onboarding."""

import logging
from dataclasses import dataclass
from uuid import UUID

from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.user_role import UserRoleType
from app.schemas.gm_onboarding import GMOnboardingRequest
from app.services.gm_onboarding_persistence import (
    replace_gm_availability,
    replace_gm_system_experience,
    upsert_gm_profile,
)
from app.services.onboarding_common import (
    OnboardingConflictError,
    OnboardingPersistenceError,
    OnboardingValidationError,
    ensure_user_role,
    prepare_available_display_name,
    resolve_active_game_systems,
)

LOGGER = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class GMOnboardingResult:
    """Safe service result returned after one successful commit."""

    gm_profile_id: UUID
    display_name: str
    system_slugs: list[str]
    availability_count: int


def save_gm_onboarding(
    session: Session,
    user: User,
    payload: GMOnboardingRequest,
) -> GMOnboardingResult:
    """Replace one authenticated user's GM onboarding state atomically."""

    try:
        prepared_name = prepare_available_display_name(session, user, payload.display_name)
        systems_by_slug = resolve_active_game_systems(
            session,
            [item.system_slug for item in payload.systems],
        )

        user.display_name = prepared_name.display
        user.display_name_normalized = prepared_name.normalized
        ensure_user_role(session, user.id, UserRoleType.GM)
        profile = upsert_gm_profile(session, user, payload)
        replace_gm_system_experience(session, profile, payload, systems_by_slug)
        replace_gm_availability(session, profile, payload)
        session.commit()

        LOGGER.info(
            "Saved GM onboarding for user %s with %s systems and %s windows",
            user.id,
            len(payload.systems),
            len(payload.availability),
        )
        return GMOnboardingResult(
            gm_profile_id=profile.id,
            display_name=prepared_name.display,
            system_slugs=[item.system_slug for item in payload.systems],
            availability_count=len(payload.availability),
        )
    except (OnboardingValidationError, OnboardingConflictError):
        session.rollback()
        raise
    except IntegrityError as exc:
        session.rollback()
        LOGGER.warning("GM onboarding conflict for user %s", user.id, exc_info=True)
        raise OnboardingConflictError(
            "GM onboarding conflicts with existing account data."
        ) from exc
    except SQLAlchemyError as exc:
        session.rollback()
        LOGGER.exception("GM onboarding database failure for user %s", user.id)
        raise OnboardingPersistenceError("GM onboarding could not be saved.") from exc
    except Exception as exc:
        session.rollback()
        LOGGER.exception("Unexpected GM onboarding failure for user %s", user.id)
        raise OnboardingPersistenceError("GM onboarding could not be saved.") from exc
