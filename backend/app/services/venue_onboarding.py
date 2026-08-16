"""Transaction orchestration for authenticated Venue onboarding."""

import logging
from dataclasses import dataclass
from uuid import UUID

from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.user_role import UserRoleType
from app.schemas.venue_onboarding import VenueOnboardingRequest
from app.services.onboarding_common import (
    OnboardingConflictError,
    OnboardingPersistenceError,
    ensure_user_role,
)
from app.services.venue_onboarding_persistence import (
    create_venue_and_claim,
    ensure_venue_is_new,
)

LOGGER = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class VenueOnboardingResult:
    """Safe service result returned after one successful Venue claim."""

    venue_id: UUID
    venue_manager_id: UUID
    name: str
    slug: str
    role: str


def save_venue_onboarding(
    session: Session,
    user: User,
    payload: VenueOnboardingRequest,
) -> VenueOnboardingResult:
    """Create a new Venue and pending manager claim atomically."""

    try:
        ensure_venue_is_new(session, payload)
        ensure_user_role(session, user.id, UserRoleType.VENUE_MANAGER)
        venue, relationship = create_venue_and_claim(session, user, payload)
        session.commit()

        LOGGER.info(
            "Created pending Venue claim %s for user %s",
            venue.id,
            user.id,
        )
        return VenueOnboardingResult(
            venue_id=venue.id,
            venue_manager_id=relationship.id,
            name=venue.name,
            slug=venue.slug,
            role=relationship.role,
        )
    except OnboardingConflictError:
        session.rollback()
        raise
    except IntegrityError as exc:
        session.rollback()
        LOGGER.warning("Venue onboarding conflict for user %s", user.id, exc_info=True)
        raise OnboardingConflictError(
            "Venue onboarding conflicts with existing venue data."
        ) from exc
    except SQLAlchemyError as exc:
        session.rollback()
        LOGGER.exception("Venue onboarding database failure for user %s", user.id)
        raise OnboardingPersistenceError("Venue onboarding could not be saved.") from exc
    except Exception as exc:
        session.rollback()
        LOGGER.exception("Unexpected Venue onboarding failure for user %s", user.id)
        raise OnboardingPersistenceError("Venue onboarding could not be saved.") from exc
