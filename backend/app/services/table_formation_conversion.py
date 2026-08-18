"""Idempotent transaction that converts one TableMatch into formation state."""

import logging
from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.event import Event
from app.models.game_series import GameSeries
from app.models.gm_profile import GMProfile
from app.models.matching_signal import SignalStatus
from app.models.table_match import TableMatchStatus
from app.models.user_role import UserRole, UserRoleType
from app.models.venue_booking_request import VenueBookingRequest
from app.services.table_formation_context import load_formation_match_context
from app.services.table_formation_errors import TableFormationConflictError, TableFormationError
from app.services.table_formation_rows import build_formation_rows

LOGGER = logging.getLogger(__name__)
FORMABLE_MATCH_STATUSES = {
    TableMatchStatus.POTENTIAL.value,
    TableMatchStatus.INVITED.value,
    TableMatchStatus.FORMING.value,
}


@dataclass(frozen=True, slots=True)
class FormationResult:
    """Identifiers returned from an idempotent TableMatch conversion."""

    game_series_id: UUID
    event_id: UUID
    venue_booking_request_id: UUID
    created: bool


def form_table_match(
    session: Session,
    *,
    table_match_id: UUID,
    caller_user_id: UUID,
    title: str,
    description: str | None = None,
) -> FormationResult:
    """Create one durable Event/booking set or return the existing conversion."""

    try:
        existing = _existing_result(session, table_match_id, caller_user_id)
        if existing is not None:
            return existing

        context = load_formation_match_context(
            session,
            table_match_id=table_match_id,
            caller_user_id=caller_user_id,
        )
        if context.match.status not in FORMABLE_MATCH_STATUSES:
            raise TableFormationConflictError("Table Match is no longer formable.")

        rows = build_formation_rows(
            context,
            title=title,
            description=description,
        )
        session.add_all([rows.series, rows.event, rows.expectations, rows.booking])
        context.match.status = TableMatchStatus.CONVERTED.value
        context.gm_supply.status = SignalStatus.MATCHED.value
        session.commit()
        return FormationResult(
            game_series_id=rows.series.id,
            event_id=rows.event.id,
            venue_booking_request_id=rows.booking.id,
            created=True,
        )
    except IntegrityError:
        session.rollback()
        recovered = _existing_result(session, table_match_id, caller_user_id)
        if recovered is not None:
            return recovered
        LOGGER.exception("Table formation uniqueness recovery failed")
        raise TableFormationConflictError("Table formation conflicted with current state.") from None
    except TableFormationError:
        session.rollback()
        raise
    except Exception:
        session.rollback()
        LOGGER.exception("TableMatch conversion failed")
        raise


def _existing_result(
    session: Session,
    table_match_id: UUID,
    caller_user_id: UUID,
) -> FormationResult | None:
    row = session.execute(
        select(Event, GameSeries, VenueBookingRequest)
        .join(GameSeries, GameSeries.id == Event.game_series_id)
        .join(VenueBookingRequest, VenueBookingRequest.event_id == Event.id)
        .join(GMProfile, GMProfile.id == Event.gm_profile_id)
        .join(
            UserRole,
            (UserRole.user_id == GMProfile.user_id)
            & (UserRole.role == UserRoleType.GM.value),
        )
        .where(
            Event.table_match_id == table_match_id,
            GMProfile.user_id == caller_user_id,
        )
    ).one_or_none()
    if row is None:
        return None
    event, series, booking = row
    return FormationResult(
        game_series_id=series.id,
        event_id=event.id,
        venue_booking_request_id=booking.id,
        created=False,
    )


__all__ = ["FormationResult", "form_table_match"]
