"""Admin-controlled verification for initial Venue onboarding claims."""

import logging
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.audit.service import record_privileged_action
from app.models.user import User
from app.models.user_role import UserRoleType
from app.models.venue import Venue, VenueManager

LOGGER = logging.getLogger(__name__)


class VenueVerificationValidationError(ValueError):
    """Submitted Venue verification data is invalid."""


class VenueVerificationNotFoundError(LookupError):
    """The requested Venue claim does not exist."""


class VenueVerificationConflictError(RuntimeError):
    """The requested Venue claim cannot be verified in its current state."""


class VenueVerificationPersistenceError(RuntimeError):
    """Venue verification could not be persisted."""


def verify_initial_venue_claim(
    session: Session,
    admin_user: User,
    *,
    venue_id: UUID,
    venue_manager_id: UUID,
    latitude: float,
    longitude: float,
) -> Venue:
    """Verify one initial Venue claim and cache trusted coordinates atomically."""

    if not -90 <= latitude <= 90:
        raise VenueVerificationValidationError("Venue latitude must be between -90 and 90.")
    if not -180 <= longitude <= 180:
        raise VenueVerificationValidationError("Venue longitude must be between -180 and 180.")

    try:
        row = session.execute(
            select(Venue, VenueManager)
            .join(VenueManager, VenueManager.venue_id == Venue.id)
            .where(
                Venue.id == venue_id,
                VenueManager.id == venue_manager_id,
            )
            .with_for_update()
        ).one_or_none()

        if row is None:
            raise VenueVerificationNotFoundError(
                "The requested Venue Manager claim does not exist for this Venue."
            )

        venue, manager = row

        if venue.verified:
            raise VenueVerificationConflictError("This Venue is already verified.")
        if manager.verified_at is not None:
            raise VenueVerificationConflictError("This Venue Manager claim is already verified.")

        verified_at = datetime.now(UTC)
        venue.latitude = latitude
        venue.longitude = longitude
        venue.verified = True
        manager.verified_at = verified_at

        record_privileged_action(
            session,
            actor_user_id=admin_user.id,
            actor_role=UserRoleType.ADMIN.value,
            action="venue.verify_initial_claim",
            target_type="venue",
            target_id=str(venue.id),
            outcome="success",
            reason_code="initial_claim_approved",
        )

        session.commit()
        LOGGER.info(
            "Admin user %s verified Venue %s claim %s",
            admin_user.id,
            venue.id,
            manager.id,
        )
        return venue

    except (
        VenueVerificationNotFoundError,
        VenueVerificationConflictError,
        VenueVerificationValidationError,
    ):
        session.rollback()
        raise
    except PermissionError as exc:
        session.rollback()
        LOGGER.warning(
            "Privileged audit authorization failed during Venue verification",
            exc_info=True,
        )
        raise VenueVerificationPersistenceError(
            "Venue verification authorization could not be confirmed."
        ) from exc
    except SQLAlchemyError as exc:
        session.rollback()
        LOGGER.exception("Database failure while verifying Venue %s", venue_id)
        raise VenueVerificationPersistenceError("Venue verification could not be saved.") from exc
    except Exception as exc:
        session.rollback()
        LOGGER.exception("Unexpected failure while verifying Venue %s", venue_id)
        raise VenueVerificationPersistenceError("Venue verification could not be saved.") from exc
