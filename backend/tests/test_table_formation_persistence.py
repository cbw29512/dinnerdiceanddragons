"""Round-trip persistence tests for production table formation state."""

from datetime import date

import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from table_formation_test_support import FormationSeed, create_formation_session, seed_formation_parents

from app.models.event import Event, EventStatus
from app.models.game_series import GameSeries
from app.models.registration import Registration, RegistrationStatus
from app.models.table_expectations import TableExpectations
from app.models.venue_booking_request import VenueBookingRequest, VenueBookingStatus


@pytest.fixture()
def session() -> Session:
    db, engine = create_formation_session()
    try:
        yield db
    finally:
        db.close()
        engine.dispose()


def create_formed_event(session: Session, seed: FormationSeed) -> Event:
    series = GameSeries(
        table_match_id=seed.table_match.id,
        title="Friday Night Dragons",
        gm_profile_id=seed.gm_profile.id,
        game_system_id=seed.system.id,
        venue_id=seed.venue.id,
        expected_sessions=1,
        starts_on=date(2026, 8, 21),
    )
    session.add(series)
    session.flush()

    event = Event(
        game_series_id=series.id,
        table_match_id=seed.table_match.id,
        slug="friday-night-dragons-2026-08-21",
        title="Friday Night Dragons",
        description="A production table formation test Event.",
        gm_profile_id=seed.gm_profile.id,
        game_system_id=seed.system.id,
        venue_id=seed.venue.id,
        event_type="one_shot",
        join_mode="request",
        starts_at=seed.table_match.proposed_start,
        ends_at=seed.table_match.proposed_end,
        min_players=seed.table_match.minimum_players,
        max_players=seed.table_match.maximum_players,
        beginner_friendly=True,
    )
    session.add(event)
    session.flush()

    session.add_all(
        [
            TableExpectations(
                event_id=event.id,
                tone="Heroic adventure",
                table_style="Collaborative",
                safety_framework="Lines and veils plus X-card.",
            ),
            Registration(
                event_id=event.id,
                player_profile_id=seed.player_profile.id,
            ),
            VenueBookingRequest(
                venue_table_window_id=seed.venue_window.id,
                gm_profile_id=seed.gm_profile.id,
                table_match_id=seed.table_match.id,
                game_series_id=series.id,
                event_id=event.id,
                requested_start=event.starts_at,
                requested_end=event.ends_at,
                tables_requested=1,
                expected_guests=1,
            ),
        ]
    )
    session.commit()
    return event


def test_formation_state_round_trips_with_safe_defaults(session: Session) -> None:
    seed = seed_formation_parents(session)
    event = create_formed_event(session, seed)

    loaded = session.get(Event, event.id)
    assert loaded is not None
    assert loaded.status == EventStatus.DRAFT.value
    assert loaded.beginner_friendly is True

    registration = session.scalar(select(Registration))
    assert registration is not None
    assert registration.status == RegistrationStatus.REQUESTED.value

    booking = session.scalar(select(VenueBookingRequest))
    assert booking is not None
    assert booking.status == VenueBookingStatus.REQUESTED.value
    assert booking.expected_guests == 1

    expectations = session.scalar(select(TableExpectations))
    assert expectations is not None
    assert expectations.new_players_welcome is True


def test_event_delete_cascades_expectations_and_registrations(session: Session) -> None:
    seed = seed_formation_parents(session)
    event = create_formed_event(session, seed)

    session.delete(event)
    session.commit()

    assert session.scalar(select(func.count()).select_from(TableExpectations)) == 0
    assert session.scalar(select(func.count()).select_from(Registration)) == 0
    booking = session.scalar(select(VenueBookingRequest))
    assert booking is not None
    assert booking.event_id is None


def test_same_table_match_cannot_create_duplicate_event(session: Session) -> None:
    seed = seed_formation_parents(session)
    create_formed_event(session, seed)
    duplicate = Event(
        table_match_id=seed.table_match.id,
        slug="duplicate-table-match-event",
        title="Duplicate",
        gm_profile_id=seed.gm_profile.id,
        game_system_id=seed.system.id,
        venue_id=seed.venue.id,
        event_type="one_shot",
        join_mode="request",
        starts_at=seed.table_match.proposed_start,
        ends_at=seed.table_match.proposed_end,
        min_players=1,
        max_players=5,
    )
    session.add(duplicate)

    with pytest.raises(IntegrityError):
        session.commit()
    session.rollback()
