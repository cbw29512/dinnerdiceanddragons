"""Idempotent GM-owned conversion from TableMatch to production Event state."""

import logging
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.models.game_series import GameSeries
from app.models.table_expectations import TableExpectations
from app.models.table_match import TableMatch, TableMatchStatus
from app.models.user import User
from app.models.venue_booking_request import VenueBookingRequest, VenueBookingStatus
from app.schemas.table_formation import FormTableMatchRequest, FormTableMatchResponse
from app.services.table_formation_builders import (
    build_event,
    build_game_series,
    formation_response,
    load_formation_parents,
)
from app.services.table_formation_errors import (
    FormationConflictError,
    FormationForbiddenError,
    FormationNotFoundError,
    FormationPersistenceError,
)
from app.services.table_formation_existing import existing_formation_response
from app.services.venue_booking_capacity import (
    VenueCapacityConflictError,
    require_booking_capacity,
)

LOGGER = logging.getLogger(__name__)


def form_table_match(
    session: Session,
    user: User,
    table_match_id: UUID,
    payload: FormTableMatchRequest,
) -> FormTableMatchResponse:
    """Create one durable formation transaction or return its existing result."""

    try:
        match = session.scalar(
            select(TableMatch).where(TableMatch.id == table_match_id).with_for_update()
        )
        if match is None:
            raise FormationNotFoundError("Table Match was not found.")

        parents = load_formation_parents(session, match)
        if parents.gm.user_id != user.id:
            raise FormationForbiddenError("Only the matched GM can form this table.")

        existing = existing_formation_response(session, match)
        if existing is not None:
            return existing
        if match.status != TableMatchStatus.POTENTIAL.value:
            raise FormationConflictError("Table Match is no longer available for formation.")

        series = build_game_series(match, parents, payload)
        if series is not None:
            session.add(series)
            session.flush()

        event = build_event(match, parents, payload, series)
        session.add(event)
        session.flush()
        session.add(TableExpectations(event_id=event.id, **payload.expectations.model_dump()))

        booking = _new_booking(
            match=match,
            window_id=parents.window.id,
            gm_id=parents.gm.id,
            event_id=event.id,
            series=series,
            approval_required=parents.window.approval_required,
            payload=payload,
        )
        session.add(booking)
        session.flush()
        if booking.status == VenueBookingStatus.APPROVED.value:
            require_booking_capacity(session, booking, parents.window)

        match.status = TableMatchStatus.CONVERTED.value
        session.commit()
        return formation_response(match, event, booking, series, created=True)
    except (
        FormationNotFoundError,
        FormationForbiddenError,
        FormationConflictError,
        VenueCapacityConflictError,
    ):
        session.rollback()
        raise
    except IntegrityError as exc:
        session.rollback()
        recovered = _recover_after_race(session, user, table_match_id)
        if recovered is not None:
            return recovered
        LOGGER.exception("Table formation unique-key recovery failed")
        raise FormationConflictError("Table formation changed concurrently.") from exc
    except SQLAlchemyError as exc:
        session.rollback()
        LOGGER.exception("Table formation persistence failed")
        raise FormationPersistenceError("Table formation could not be persisted.") from exc


def _new_booking(
    *,
    match: TableMatch,
    window_id: UUID,
    gm_id: UUID,
    event_id: UUID,
    series: GameSeries | None,
    approval_required: bool,
    payload: FormTableMatchRequest,
) -> VenueBookingRequest:
    return VenueBookingRequest(
        venue_table_window_id=window_id,
        gm_profile_id=gm_id,
        table_match_id=match.id,
        game_series_id=series.id if series else None,
        event_id=event_id,
        requested_start=match.proposed_start,
        requested_end=match.proposed_end,
        tables_requested=1,
        expected_guests=1,
        status=(
            VenueBookingStatus.REQUESTED.value
            if approval_required
            else VenueBookingStatus.APPROVED.value
        ),
        gm_message=payload.gm_message,
    )


def _recover_after_race(
    session: Session,
    user: User,
    table_match_id: UUID,
) -> FormTableMatchResponse | None:
    match = session.get(TableMatch, table_match_id)
    if match is None:
        return None
    parents = load_formation_parents(session, match)
    if parents.gm.user_id != user.id:
        return None
    return existing_formation_response(session, match)


__all__ = ["form_table_match"]
