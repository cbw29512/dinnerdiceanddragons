"""Owning-GM update transaction for shared Event expectations."""

import logging
from collections.abc import Mapping
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.event import Event
from app.models.registration import Registration
from app.models.table_expectations import TableExpectations
from app.services.event_registration_access import require_event_gm
from app.services.table_formation_errors import (
    TableFormationConflictError,
    TableFormationError,
    TableFormationNotFoundError,
)

LOGGER = logging.getLogger(__name__)
EDITABLE_FIELDS = frozenset(
    {
        "tone",
        "age_expectation",
        "table_style",
        "pvp_policy",
        "homebrew_policy",
        "character_death_policy",
        "mature_content_policy",
        "alcohol_policy",
        "new_players_welcome",
        "break_policy",
        "safety_framework",
        "environment_notes",
        "accessibility_notes",
        "other_notes",
    }
)


def update_event_expectations(
    session: Session,
    *,
    event_id: UUID,
    caller_user_id: UUID,
    values: Mapping[str, object],
) -> TableExpectations:
    """Replace supplied expectation fields only before the first registration exists."""

    try:
        event = session.scalar(select(Event).where(Event.id == event_id).with_for_update())
        if event is None:
            raise TableFormationNotFoundError("Event is not available.")
        require_event_gm(session, event=event, caller_user_id=caller_user_id)

        registration_count = int(
            session.scalar(
                select(func.count())
                .select_from(Registration)
                .where(Registration.event_id == event.id)
            )
            or 0
        )
        if registration_count:
            raise TableFormationConflictError(
                "Table expectations are frozen after the first Player registration."
            )

        expectations = session.scalar(
            select(TableExpectations)
            .where(TableExpectations.event_id == event.id)
            .with_for_update()
        )
        if expectations is None:
            raise TableFormationNotFoundError("Event expectations are not available.")

        for field_name, value in values.items():
            if field_name not in EDITABLE_FIELDS:
                raise TableFormationConflictError("Unsupported table expectation field.")
            setattr(expectations, field_name, value)

        session.commit()
        return expectations
    except TableFormationError:
        session.rollback()
        raise
    except Exception:
        session.rollback()
        LOGGER.exception("Event expectations update failed")
        raise


__all__ = ["update_event_expectations"]
