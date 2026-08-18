"""Persistence and invariant tests for Step 4 table formation."""

from datetime import UTC, datetime

import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from table_formation_test_support import (
    FormationSeed,
    create_formation_session,
    seed_formation_inputs,
)

from app.models.event import Event, EventStatus
from app.models.game_series import GameSeries
from app.models.game_system import GameSystem
from app.models.gm_profile import GMProfile
from app.models.player_profile import PlayerProfile
from app.models.registration import Registration
from app.models.table_expectations import TableExpectations
from app.models.table_match import TableMatch
from app.models.venue import Venue
from app.models.venue_booking_request import VenueBookingRequest
from app.models.venue_table_window import VenueTableWindow


@pytest.fixture()
def session() -> Session:
    db, engine = create_formation_session()
    try:
        yield db
    finally:
        db.close()
        engine.dispose()


def create_event(session: Session) -> Event:
    seed = seed_formation_inputs(session)
    event = Event(
        table_match_id=seed.match.id,
        slug="formation-night",
        title="Formation Night",
        description="A production table formation test.",
        gm_profile_id=seed.gm.id,
        game_system_id=seed.system.id,
        venue_id=seed.venue.id,
        event_type="one_shot",
        join_mode="request_to_join",
        status=EventStatus.VENUE_REQUESTED.value,
        starts_at=seed.match.proposed_start,
        ends_at=seed.match.proposed_end,
        min_players=3,
        max_players=5,
    )
    session.add(event)
    session.flush()
    return event


def test_formation_entities_round_trip_together(session: Session) -> None:
    event = create_event(session)
    seed = seed_formation_inputs_for_existing_event(session, event)
    series = GameSeries(
        title="Formation Campaign",
        gm_profile_id=seed.gm.id,
        game_system_id=seed.system.id,
        venue_id=seed.venue.id,
        expected_sessions=4,
        starts_on=event.starts_at.date(),
    )
    session.add(series)
    session.flush()
    event.game_series_id = series.id
    session.add_all(
        [
            TableExpectations(
                event_id=event.id,
                play_style="Roleplay-forward with clear combat expectations.",
                boundaries="Respectful table; no PvP without explicit consent.",
            ),
            Registration(
                event_id=event.id,
                player_profile_id=seed.player.id,
                status="confirmed",
                expectations_acknowledged_at=datetime.now(UTC),
            ),
            VenueBookingRequest(
                venue_table_window_id=seed.window.id,
                gm_profile_id=seed.gm.id,
                table_match_id=event.table_match_id,
                game_series_id=series.id,
                event_id=event.id,
                requested_start=event.starts_at,
                requested_end=event.ends_at,
                tables_requested=1,
                expected_guests=2,
            ),
        ]
    )
    session.commit()

    assert session.scalar(select(func.count()).select_from(GameSeries)) == 1
    assert session.scalar(select(func.count()).select_from(TableExpectations)) == 1
    assert session.scalar(select(func.count()).select_from(Registration)) == 1
    assert session.scalar(select(func.count()).select_from(VenueBookingRequest)) == 1


def test_table_match_can_have_only_one_event(session: Session) -> None:
    event = create_event(session)
    session.commit()
    duplicate = Event(
        table_match_id=event.table_match_id,
        slug="duplicate-formation-night",
        title="Duplicate",
        description="Should fail.",
        gm_profile_id=event.gm_profile_id,
        game_system_id=event.game_system_id,
        venue_id=event.venue_id,
        event_type="one_shot",
        join_mode="request_to_join",
        status="forming",
        starts_at=event.starts_at,
        ends_at=event.ends_at,
        min_players=3,
        max_players=5,
    )
    session.add(duplicate)

    with pytest.raises(IntegrityError):
        session.commit()
    session.rollback()


def test_registration_is_unique_per_event_and_player(session: Session) -> None:
    event = create_event(session)
    seed = seed_formation_inputs_for_existing_event(session, event)
    session.add_all(
        [
            Registration(event_id=event.id, player_profile_id=seed.player.id),
            Registration(event_id=event.id, player_profile_id=seed.player.id),
        ]
    )

    with pytest.raises(IntegrityError):
        session.commit()
    session.rollback()


def test_event_rejects_impossible_player_range(session: Session) -> None:
    event = create_event(session)
    event.min_players = 5
    event.max_players = 3

    with pytest.raises(IntegrityError):
        session.commit()
    session.rollback()


def test_booking_rejects_non_positive_time_window(session: Session) -> None:
    event = create_event(session)
    seed = seed_formation_inputs_for_existing_event(session, event)
    session.add(
        VenueBookingRequest(
            venue_table_window_id=seed.window.id,
            gm_profile_id=seed.gm.id,
            table_match_id=event.table_match_id,
            event_id=event.id,
            requested_start=event.starts_at,
            requested_end=event.starts_at,
            tables_requested=1,
            expected_guests=1,
        )
    )

    with pytest.raises(IntegrityError):
        session.commit()
    session.rollback()


def test_deleting_event_cascades_expectations_and_registrations(session: Session) -> None:
    event = create_event(session)
    seed = seed_formation_inputs_for_existing_event(session, event)
    session.add_all(
        [
            TableExpectations(
                event_id=event.id,
                play_style="Collaborative.",
                boundaries="Respect the table.",
            ),
            Registration(event_id=event.id, player_profile_id=seed.player.id),
        ]
    )
    session.commit()

    session.delete(event)
    session.commit()

    assert session.scalar(select(func.count()).select_from(TableExpectations)) == 0
    assert session.scalar(select(func.count()).select_from(Registration)) == 0


def seed_formation_inputs_for_existing_event(
    session: Session,
    event: Event,
) -> FormationSeed:
    return FormationSeed(
        gm=session.get(GMProfile, event.gm_profile_id),
        player=session.scalar(select(PlayerProfile)),
        venue=session.get(Venue, event.venue_id),
        system=session.get(GameSystem, event.game_system_id),
        window=session.scalar(select(VenueTableWindow)),
        match=session.get(TableMatch, event.table_match_id),
    )
