"""Transaction tests for idempotent TableMatch -> Event formation."""

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from table_formation_test_support import create_formation_session, seed_formation_parents

from app.models.event import Event, EventStatus
from app.models.game_series import GameSeries
from app.models.gm_supply_signal import GMSupplySignal
from app.models.matching_signal import SignalStatus
from app.models.table_expectations import TableExpectations
from app.models.table_match import TableMatch, TableMatchStatus
from app.models.venue_booking_request import VenueBookingRequest, VenueBookingStatus
from app.services.table_formation_conversion import form_table_match
from app.services.table_formation_errors import TableFormationForbiddenError


@pytest.fixture()
def session() -> Session:
    db, engine = create_formation_session()
    try:
        yield db
    finally:
        db.close()
        engine.dispose()


def test_gm_converts_match_into_one_durable_formation(session: Session) -> None:
    seed = seed_formation_parents(session)

    result = form_table_match(
        session,
        table_match_id=seed.table_match.id,
        caller_user_id=seed.gm_user.id,
        title="Friday Night Dragons",
        description="A new production table.",
    )

    assert result.created is True
    assert session.scalar(select(func.count()).select_from(GameSeries)) == 1
    assert session.scalar(select(func.count()).select_from(Event)) == 1
    assert session.scalar(select(func.count()).select_from(TableExpectations)) == 1
    assert session.scalar(select(func.count()).select_from(VenueBookingRequest)) == 1

    event = session.get(Event, result.event_id)
    booking = session.get(VenueBookingRequest, result.venue_booking_request_id)
    match = session.get(TableMatch, seed.table_match.id)
    supply = session.scalar(select(GMSupplySignal))
    assert event is not None and booking is not None and match is not None and supply is not None
    assert event.status == EventStatus.VENUE_REQUESTED.value
    assert booking.status == VenueBookingStatus.REQUESTED.value
    assert booking.expected_guests == 1
    assert match.status == TableMatchStatus.CONVERTED.value
    assert supply.status == SignalStatus.MATCHED.value


def test_conversion_retry_returns_same_ids_after_supply_is_marked_matched(session: Session) -> None:
    seed = seed_formation_parents(session)
    first = form_table_match(
        session,
        table_match_id=seed.table_match.id,
        caller_user_id=seed.gm_user.id,
        title="Friday Night Dragons",
    )

    second = form_table_match(
        session,
        table_match_id=seed.table_match.id,
        caller_user_id=seed.gm_user.id,
        title="Ignored Retry Title",
    )

    assert second.created is False
    assert second.event_id == first.event_id
    assert second.game_series_id == first.game_series_id
    assert second.venue_booking_request_id == first.venue_booking_request_id
    assert session.scalar(select(func.count()).select_from(Event)) == 1


def test_non_gm_cannot_form_another_users_match(session: Session) -> None:
    seed = seed_formation_parents(session)

    with pytest.raises(TableFormationForbiddenError):
        form_table_match(
            session,
            table_match_id=seed.table_match.id,
            caller_user_id=seed.player_user.id,
            title="Unauthorized Table",
        )


def test_no_approval_required_starts_event_forming_with_approved_booking(session: Session) -> None:
    seed = seed_formation_parents(session)
    seed.venue_window.approval_required = False
    session.commit()

    result = form_table_match(
        session,
        table_match_id=seed.table_match.id,
        caller_user_id=seed.gm_user.id,
        title="Open Venue Table",
    )

    event = session.get(Event, result.event_id)
    booking = session.get(VenueBookingRequest, result.venue_booking_request_id)
    assert event is not None and booking is not None
    assert event.status == EventStatus.FORMING.value
    assert booking.status == VenueBookingStatus.APPROVED.value
