"""Idempotent lookup helpers for already converted Table Matches."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.event import Event
from app.models.game_series import GameSeries
from app.models.table_match import TableMatch
from app.models.user import User
from app.models.venue_booking_request import VenueBookingRequest
from app.schemas.table_formation import FormTableMatchResponse
from app.services.table_formation_builders import (
    formation_response,
    load_formation_parents,
)
from app.services.table_formation_errors import FormationConflictError


def existing_formation_response(
    session: Session,
    match: TableMatch,
) -> FormTableMatchResponse | None:
    event = session.scalar(select(Event).where(Event.table_match_id == match.id))
    if event is None:
        return None
    booking = session.scalar(
        select(VenueBookingRequest).where(VenueBookingRequest.event_id == event.id)
    )
    if booking is None:
        raise FormationConflictError("Existing formation is missing its Venue booking state.")
    series = session.get(GameSeries, event.game_series_id) if event.game_series_id else None
    return formation_response(match, event, booking, series, created=False)


def recover_existing_formation(
    session: Session,
    user: User,
    table_match_id: UUID,
) -> FormTableMatchResponse | None:
    """Recover the winner of a concurrent idempotent formation attempt."""

    match = session.get(TableMatch, table_match_id)
    if match is None:
        return None
    parents = load_formation_parents(session, match)
    if parents.gm.user_id != user.id:
        return None
    return existing_formation_response(session, match)


__all__ = ["existing_formation_response", "recover_existing_formation"]
