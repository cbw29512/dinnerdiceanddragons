"""Tests for physical Venue table-capacity reservation rules."""

from datetime import timedelta

import pytest
from event_lifecycle_test_support import build_lifecycle_factory

from app.models.event import Event
from app.models.venue_booking_request import VenueBookingRequest
from app.models.venue_table_window import VenueTableWindow
from app.services.venue_booking_capacity import (
    VenueCapacityConflictError,
    require_booking_capacity,
)


def test_second_overlapping_booking_cannot_exceed_single_table_capacity() -> None:
    factory, seed = build_lifecycle_factory(player_count=1)

    with factory() as session:
        existing = session.get(VenueBookingRequest, seed.booking_id)
        assert existing is not None
        window = session.get(VenueTableWindow, existing.venue_table_window_id)
        original_event = session.get(Event, seed.event_id)
        assert window is not None and original_event is not None

        second_event = Event(
            slug="overlapping-event",
            title="Overlapping Event",
            description="Competes for the same physical table.",
            gm_profile_id=original_event.gm_profile_id,
            game_system_id=original_event.game_system_id,
            venue_id=original_event.venue_id,
            event_type="one_shot",
            join_mode="request_to_join",
            status="venue_requested",
            starts_at=original_event.starts_at + timedelta(minutes=30),
            ends_at=original_event.ends_at + timedelta(minutes=30),
            min_players=1,
            max_players=1,
        )
        session.add(second_event)
        session.flush()
        candidate = VenueBookingRequest(
            venue_table_window_id=window.id,
            gm_profile_id=original_event.gm_profile_id,
            event_id=second_event.id,
            requested_start=second_event.starts_at,
            requested_end=second_event.ends_at,
            tables_requested=1,
            expected_guests=1,
            status="requested",
        )
        session.add(candidate)
        session.flush()

        with pytest.raises(VenueCapacityConflictError):
            require_booking_capacity(session, candidate, window)


def test_non_overlapping_booking_can_reuse_same_table() -> None:
    factory, seed = build_lifecycle_factory(player_count=1)

    with factory() as session:
        existing = session.get(VenueBookingRequest, seed.booking_id)
        assert existing is not None
        window = session.get(VenueTableWindow, existing.venue_table_window_id)
        original_event = session.get(Event, seed.event_id)
        assert window is not None and original_event is not None

        second_event = Event(
            slug="later-event",
            title="Later Event",
            description="Uses the table after the first reservation ends.",
            gm_profile_id=original_event.gm_profile_id,
            game_system_id=original_event.game_system_id,
            venue_id=original_event.venue_id,
            event_type="one_shot",
            join_mode="request_to_join",
            status="venue_requested",
            starts_at=original_event.ends_at,
            ends_at=original_event.ends_at + timedelta(hours=3),
            min_players=1,
            max_players=1,
        )
        session.add(second_event)
        session.flush()
        candidate = VenueBookingRequest(
            venue_table_window_id=window.id,
            gm_profile_id=original_event.gm_profile_id,
            event_id=second_event.id,
            requested_start=second_event.starts_at,
            requested_end=second_event.ends_at,
            tables_requested=1,
            expected_guests=1,
            status="requested",
        )
        session.add(candidate)
        session.flush()

        snapshot = require_booking_capacity(session, candidate, window)
        assert snapshot.capacity_tables == 1
        assert snapshot.already_reserved_tables == 0
