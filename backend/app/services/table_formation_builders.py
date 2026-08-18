"""Pure builders and parent loading for Table Match conversion."""

import re
from dataclasses import dataclass
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.event import Event, EventStatus
from app.models.game_series import GameSeries
from app.models.gm_profile import GMProfile
from app.models.gm_supply_signal import GMSupplySignal
from app.models.table_match import TableMatch
from app.models.venue_booking_request import VenueBookingRequest
from app.models.venue_table_window import VenueTableWindow
from app.schemas.table_formation import FormTableMatchRequest, FormTableMatchResponse
from app.services.table_formation_errors import FormationConflictError


@dataclass(frozen=True, slots=True)
class FormationParents:
    gm: GMProfile
    window: VenueTableWindow


def load_formation_parents(session: Session, match: TableMatch) -> FormationParents:
    gm = session.scalar(
        select(GMProfile)
        .join(GMSupplySignal, GMSupplySignal.gm_profile_id == GMProfile.id)
        .where(GMSupplySignal.id == match.gm_supply_signal_id)
    )
    window = session.get(VenueTableWindow, match.venue_table_window_id)
    if gm is None or window is None:
        raise FormationConflictError("Table Match parent state is no longer available.")
    return FormationParents(gm=gm, window=window)


def build_game_series(
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


def build_event(
    match: TableMatch,
    parents: FormationParents,
    payload: FormTableMatchRequest,
    series: GameSeries | None,
) -> Event:
    return Event(
        game_series_id=series.id if series else None,
        table_match_id=match.id,
        slug=event_slug(payload.title, match.id),
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


def event_slug(title: str, match_id: UUID) -> str:
    normalized = re.sub(r"[^a-z0-9]+", "-", title.strip().lower()).strip("-")
    base = normalized[:150] or "table"
    return f"{base}-{str(match_id)[:8]}"


def formation_response(
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
    "FormationParents",
    "build_event",
    "build_game_series",
    "event_slug",
    "formation_response",
    "load_formation_parents",
]
