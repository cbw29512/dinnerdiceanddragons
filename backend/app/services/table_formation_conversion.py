"""Idempotent GM-owned conversion from TableMatch to production Event state."""

import logging
import re
from dataclasses import dataclass
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.models.event import Event, EventStatus
from app.models.game_series import GameSeries
from app.models.gm_profile import GMProfile
from app.models.gm_supply_signal import GMSupplySignal
from app.models.table_expectations import TableExpectations
from app.models.table_match import TableMatch, TableMatchStatus
from app.models.user import User
from app.models.venue_booking_request import VenueBookingRequest, VenueBookingStatus
from app.models.venue_table_window import VenueTableWindow
from app.schemas.table_formation import FormTableMatchRequest, FormTableMatchResponse

LOGGER = logging.getLogger(__name__)


class FormationNotFoundError(LookupError):
    pass


class FormationForbiddenError(PermissionError):
    pass


class FormationConflictError(RuntimeError):
    pass


class FormationPersistenceError(RuntimeError):
    pass


@dataclass(frozen=True, slots=True)
class FormationParents:
    gm: GMProfile
    window: VenueTableWindow


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

        parents = _load_parents(session, match)
        if parents.gm.user_id != user.id:
            raise FormationForbiddenError("Only the matched GM can form this table.")

        existing = _existing_response(session, match)
        if existing is not None:
            return existing
        if match.status != TableMatchStatus.POTENTIAL.value:
            raise FormationConflictError("Table Match is no longer available for formation.")

        series = _new_series(match, parents, payload)
        if series is not None:
            session.add(series)
            session.flush()

        event = _new_event(match, parents, payload, series)
        session.add(event)
        session.flush()
        session.add(TableExpectations(event_id=event.id, **payload.expectations.model_dump()))

        booking_status = (
            VenueBookingStatus.REQUESTED.value
            if parents.window.approval_required
            else VenueBookingStatus.APPROVED.value
        )
        booking = VenueBookingRequest(
            venue_table_window_id=parents.window.id,
            gm_profile_id=parents.gm.id,
            table_match_id=match.id,
            game_series_id=series.id if series else None,
            event_id=event.id,
            requested_start=match.proposed_start,
            requested_end=match.proposed_end,
            tables_requested=1,
            expected_guests=1,
            status=booking_status,
            gm_message=payload.gm_message,
        )
        session.add(booking)
        match.status = TableMatchStatus.CONVERTED.value
        session.commit()
        return _response(match, event, booking, series, created=True)
    except (FormationNotFoundError, FormationForbiddenError, FormationConflictError):
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


def _load_parents(session: Session, match: TableMatch) -> FormationParents:
    gm = session.scalar(
        select(GMProfile)
        .join(GMSupplySignal, GMSupplySignal.gm_profile_id == GMProfile.id)
        .where(GMSupplySignal.id == match.gm_supply_signal_id)
    )
    window = session.get(VenueTableWindow, match.venue_table_window_id)
    if gm is None or window is None:
        raise FormationConflictError("Table Match parent state is no longer available.")
    return FormationParents(gm=gm, window=window)


def _new_series(
    match: TableMatch,
    parents: FormationParents,
    payload: FormTableMatchRequest,
) -> GameSeries | None:
    if payload.expected_sessions <= 1:
        return None
    try:
        starts_on = match.proposed_start.astimezone(ZoneInfo(match.timezone)).date()
    except (ZoneInfoNotFoundError, ValueError) as exc:
        raise FormationConflictError("Table Match timezone is invalid.") from exc
    return GameSeries(
        table_match_id=match.id,
        title=payload.title.strip(),
        gm_profile_id=parents.gm.id,
        game_system_id=match.game_system_id,
        venue_id=parents.window.venue_id,
        expected_sessions=payload.expected_sessions,
        starts_on=starts_on,
    )


def _new_event(
    match: TableMatch,
    parents: FormationParents,
    payload: FormTableMatchRequest,
    series: GameSeries | None,
) -> Event:
    return Event(
        game_series_id=series.id if series else None,
        table_match_id=match.id,
        slug=_event_slug(payload.title, match.id),
        title=payload.title.strip(),
        description=payload.description.strip(),
        gm_profile_id=parents.gm.id,
        game_system_id=match.game_system_id,
        venue_id=parents.window.venue_id,
        event_type=payload.event_type.value,
        join_mode=payload.join_mode.value,
        status=(
            EventStatus.VENUE_REQUESTED.value
            if parents.window.approval_required
            else EventStatus.FORMING.value
        ),
        starts_at=match.proposed_start,
        ends_at=match.proposed_end,
        min_players=match.minimum_players,
        max_players=match.maximum_players,
        minimum_age=payload.minimum_age,
        beginner_friendly=payload.beginner_friendly,
    )


def _event_slug(title: str, match_id: UUID) -> str:
    normalized = re.sub(r"[^a-z0-9]+", "-", title.strip().lower()).strip("-")
    base = normalized[:150] or "table"
    return f"{base}-{str(match_id)[:8]}"


def _existing_response(session: Session, match: TableMatch) -> FormTableMatchResponse | None:
    event = session.scalar(select(Event).where(Event.table_match_id == match.id))
    if event is None:
        return None
    booking = session.scalar(
        select(VenueBookingRequest).where(VenueBookingRequest.event_id == event.id)
    )
    if booking is None:
        raise FormationConflictError("Existing formation is missing its Venue booking state.")
    series = session.get(GameSeries, event.game_series_id) if event.game_series_id else None
    return _response(match, event, booking, series, created=False)


def _recover_after_race(
    session: Session, user: User, table_match_id: UUID
) -> FormTableMatchResponse | None:
    match = session.get(TableMatch, table_match_id)
    if match is None:
        return None
    parents = _load_parents(session, match)
    if parents.gm.user_id != user.id:
        return None
    return _existing_response(session, match)


def _response(
    match: TableMatch,
    event: Event,
    booking: VenueBookingRequest,
    series: GameSeries | None,
    *,
    created: bool,
) -> FormTableMatchResponse:
    return FormTableMatchResponse(
        table_match_id=match.id,
        event_id=event.id,
        game_series_id=series.id if series else None,
        venue_booking_request_id=booking.id,
        event_status=event.status,
        booking_status=booking.status,
        created=created,
    )


__all__ = [
    "FormationConflictError",
    "FormationForbiddenError",
    "FormationNotFoundError",
    "FormationPersistenceError",
    "form_table_match",
]
