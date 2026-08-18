"""Deterministic initial rows created when a TableMatch enters formation."""

import re
from dataclasses import dataclass
from uuid import uuid4
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from app.models.event import Event, EventStatus
from app.models.game_series import GameSeries
from app.models.table_expectations import TableExpectations
from app.models.venue_booking_request import VenueBookingRequest, VenueBookingStatus
from app.services.table_formation_context import FormationMatchContext
from app.services.table_formation_errors import TableFormationConflictError

SLUG_TOKEN_RE = re.compile(r"[^a-z0-9]+")


@dataclass(frozen=True, slots=True)
class FormationRows:
    """New durable rows created atomically from one TableMatch."""

    series: GameSeries
    event: Event
    expectations: TableExpectations
    booking: VenueBookingRequest


def build_formation_rows(
    context: FormationMatchContext,
    *,
    title: str,
    description: str | None,
) -> FormationRows:
    """Build deterministic initial formation rows without touching a Session."""

    normalized_title = title.strip()
    if not 1 <= len(normalized_title) <= 200:
        raise TableFormationConflictError("Event title must contain 1-200 characters.")

    match = context.match
    player_capacity = min(
        match.maximum_players,
        max(context.venue_window.max_people_per_table - 1, 0),
    )
    if player_capacity < match.minimum_players:
        raise TableFormationConflictError("Venue capacity no longer satisfies the table minimum.")

    try:
        local_start_date = match.proposed_start.astimezone(ZoneInfo(match.timezone)).date()
    except (ZoneInfoNotFoundError, ValueError) as exc:
        raise TableFormationConflictError("Table Match timezone is no longer valid.") from exc

    series = GameSeries(
        id=uuid4(),
        table_match_id=match.id,
        title=normalized_title,
        gm_profile_id=context.gm_profile.id,
        game_system_id=context.game_system.id,
        venue_id=context.venue.id,
        expected_sessions=1,
        starts_on=local_start_date,
    )
    event = Event(
        id=uuid4(),
        game_series_id=series.id,
        table_match_id=match.id,
        slug=_event_slug(normalized_title, match.id.hex),
        title=normalized_title,
        description=description.strip() if description and description.strip() else None,
        gm_profile_id=context.gm_profile.id,
        game_system_id=context.game_system.id,
        venue_id=context.venue.id,
        event_type=context.gm_supply.preferred_format,
        join_mode="request",
        status=(
            EventStatus.VENUE_REQUESTED.value
            if context.venue_window.approval_required
            else EventStatus.FORMING.value
        ),
        starts_at=match.proposed_start,
        ends_at=match.proposed_end,
        min_players=match.minimum_players,
        max_players=player_capacity,
        minimum_age=None,
        beginner_friendly=context.gm_profile.beginner_friendly,
    )
    expectations = TableExpectations(
        id=uuid4(),
        event_id=event.id,
        table_style=context.gm_supply.table_style,
        new_players_welcome=context.gm_profile.beginner_friendly,
    )
    booking = VenueBookingRequest(
        id=uuid4(),
        venue_table_window_id=context.venue_window.id,
        gm_profile_id=context.gm_profile.id,
        table_match_id=match.id,
        game_series_id=series.id,
        event_id=event.id,
        requested_start=match.proposed_start,
        requested_end=match.proposed_end,
        tables_requested=1,
        expected_guests=1,
        status=(
            VenueBookingStatus.REQUESTED.value
            if context.venue_window.approval_required
            else VenueBookingStatus.APPROVED.value
        ),
    )
    return FormationRows(
        series=series,
        event=event,
        expectations=expectations,
        booking=booking,
    )


def _event_slug(title: str, match_hex: str) -> str:
    base = SLUG_TOKEN_RE.sub("-", title.casefold()).strip("-") or "table"
    return f"{base[:150].rstrip('-')}-{match_hex[:12]}"


__all__ = ["FormationRows", "build_formation_rows"]
