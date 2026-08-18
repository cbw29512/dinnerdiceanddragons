"""Role-safe Event reads for matched Players, owning GMs, and Venue Managers."""

import logging
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.models.game_system import GameSystem
from app.models.player_profile import PlayerProfile
from app.models.registration import Registration
from app.models.table_expectations import TableExpectations
from app.models.user import User
from app.models.venue import Venue
from app.schemas.event_lifecycle import (
    EventBookingSummary,
    EventExpectationsResponse,
    EventResponse,
)
from app.services.event_access import EventNotFoundError, load_event, viewer_roles
from app.services.event_lifecycle_state import booking_for_event, confirmed_registration_count
from app.services.registration_common import registration_response

LOGGER = logging.getLogger(__name__)


class EventReadError(RuntimeError):
    pass


def get_event_for_user(session: Session, user: User, event_id: UUID) -> EventResponse:
    """Return one Event without exposing unrelated/private formation state."""

    try:
        event = load_event(session, event_id)
        roles = viewer_roles(session, user, event)
        if not roles:
            raise EventNotFoundError("Event was not found.")
        system = session.get(GameSystem, event.game_system_id)
        venue = session.get(Venue, event.venue_id)
        expectations = session.scalar(
            select(TableExpectations).where(TableExpectations.event_id == event.id)
        )
        if system is None or venue is None or expectations is None:
            raise EventReadError("Event formation state is incomplete.")
        booking = booking_for_event(session, event.id)
        registration = _viewer_registration(session, user, event.id)
        return EventResponse(
            id=event.id,
            slug=event.slug,
            title=event.title,
            description=event.description,
            status=event.status,
            event_type=event.event_type,
            join_mode=event.join_mode,
            starts_at=event.starts_at,
            ends_at=event.ends_at,
            min_players=event.min_players,
            max_players=event.max_players,
            confirmed_players=confirmed_registration_count(session, event.id),
            minimum_age=event.minimum_age,
            beginner_friendly=event.beginner_friendly,
            system_name=system.name,
            system_edition=system.edition,
            venue_name=venue.name,
            venue_city=venue.city,
            venue_state_region=venue.state_region,
            viewer_roles=list(roles),
            booking=EventBookingSummary(
                id=booking.id,
                status=booking.status,
                expected_guests=booking.expected_guests,
                requested_start=booking.requested_start,
                requested_end=booking.requested_end,
            ),
            expectations=EventExpectationsResponse(
                tone=expectations.tone,
                age_environment=expectations.age_environment,
                play_style=expectations.play_style,
                boundaries=expectations.boundaries,
                pvp_policy=expectations.pvp_policy,
                homebrew_policy=expectations.homebrew_policy,
                character_death_policy=expectations.character_death_policy,
                mature_content_notes=expectations.mature_content_notes,
                alcohol_policy=expectations.alcohol_policy,
                new_players_welcome=expectations.new_players_welcome,
                break_policy=expectations.break_policy,
                safety_framework=expectations.safety_framework,
                environment_notes=expectations.environment_notes,
                accessibility_notes=expectations.accessibility_notes,
                other_notes=expectations.other_notes,
            ),
            your_registration=(registration_response(registration) if registration else None),
        )
    except (EventNotFoundError, EventReadError):
        raise
    except SQLAlchemyError as exc:
        LOGGER.exception("Role-safe Event read failed for %s", event_id)
        raise EventReadError("Event could not be loaded.") from exc


def _viewer_registration(session: Session, user: User, event_id: UUID) -> Registration | None:
    profile = session.scalar(select(PlayerProfile).where(PlayerProfile.user_id == user.id))
    if profile is None:
        return None
    return session.scalar(
        select(Registration).where(
            Registration.event_id == event_id,
            Registration.player_profile_id == profile.id,
        )
    )


__all__ = ["EventReadError", "get_event_for_user"]
