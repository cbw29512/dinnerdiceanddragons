"""Database invariant tests for production table formation entities."""

from datetime import date

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from table_formation_test_support import create_formation_session, seed_formation_parents

from app.models.event import Event
from app.models.game_series import GameSeries
from app.models.registration import Registration
from app.models.table_expectations import TableExpectations
from app.models.venue_booking_request import VenueBookingRequest


@pytest.fixture()
def session() -> Session:
    db, engine = create_formation_session()
    try:
        yield db
    finally:
        db.close()
        engine.dispose()


def new_event(session: Session):
    seed = seed_formation_parents(session)
    event = Event(
        table_match_id=seed.table_match.id,
        slug="formation-constraint-event",
        title="Formation Constraint Event",
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
    session.add(event)
    session.flush()
    return seed, event


def test_event_rejects_non_positive_time_window(session: Session) -> None:
    seed = seed_formation_parents(session)
    session.add(
        Event(
            table_match_id=seed.table_match.id,
            slug="invalid-time-event",
            title="Invalid Time Event",
            gm_profile_id=seed.gm_profile.id,
            game_system_id=seed.system.id,
            venue_id=seed.venue.id,
            event_type="one_shot",
            join_mode="request",
            starts_at=seed.table_match.proposed_start,
            ends_at=seed.table_match.proposed_start,
            min_players=1,
            max_players=5,
        )
    )

    with pytest.raises(IntegrityError):
        session.commit()
    session.rollback()


def test_registration_is_unique_per_event_and_player(session: Session) -> None:
    seed, event = new_event(session)
    session.add_all(
        [
            Registration(event_id=event.id, player_profile_id=seed.player_profile.id),
            Registration(event_id=event.id, player_profile_id=seed.player_profile.id),
        ]
    )

    with pytest.raises(IntegrityError):
        session.commit()
    session.rollback()


def test_only_one_expectations_record_is_allowed_per_event(session: Session) -> None:
    _, event = new_event(session)
    session.add_all(
        [
            TableExpectations(event_id=event.id, tone="Heroic"),
            TableExpectations(event_id=event.id, tone="Grim"),
        ]
    )

    with pytest.raises(IntegrityError):
        session.commit()
    session.rollback()


def test_booking_rejects_zero_expected_guests(session: Session) -> None:
    seed, event = new_event(session)
    session.add(
        VenueBookingRequest(
            venue_table_window_id=seed.venue_window.id,
            gm_profile_id=seed.gm_profile.id,
            table_match_id=seed.table_match.id,
            event_id=event.id,
            requested_start=event.starts_at,
            requested_end=event.ends_at,
            tables_requested=1,
            expected_guests=0,
        )
    )

    with pytest.raises(IntegrityError):
        session.commit()
    session.rollback()


def test_game_series_requires_positive_expected_session_count(session: Session) -> None:
    seed = seed_formation_parents(session)
    session.add(
        GameSeries(
            table_match_id=seed.table_match.id,
            title="Impossible Series",
            gm_profile_id=seed.gm_profile.id,
            game_system_id=seed.system.id,
            venue_id=seed.venue.id,
            expected_sessions=0,
            starts_on=date(2026, 8, 21),
        )
    )

    with pytest.raises(IntegrityError):
        session.commit()
    session.rollback()
