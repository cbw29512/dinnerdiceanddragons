"""Bounded Venue candidate loading for production Table Match."""

import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.recurring_availability_rule import RecurringAvailabilityRule
from app.models.venue import Venue
from app.models.venue_table_window import VenueTableWindow
from app.services.table_match_candidate_mapping import (
    copy_recurring_rule,
    require_bounded_candidate_rows,
)
from app.services.table_match_candidate_types import VenueCandidate
from app.services.table_match_engine_policy import MAX_MATCH_CANDIDATE_ROWS_PER_KIND

LOGGER = logging.getLogger(__name__)


def load_venue_candidates(session: Session) -> list[VenueCandidate]:
    """Load verified Venue candidates without allowing an unbounded result set."""

    try:
        rows = session.execute(
            select(VenueTableWindow, Venue, RecurringAvailabilityRule)
            .join(Venue, Venue.id == VenueTableWindow.venue_id)
            .join(
                RecurringAvailabilityRule,
                RecurringAvailabilityRule.id == VenueTableWindow.recurring_rule_id,
            )
            .where(
                VenueTableWindow.active.is_(True),
                RecurringAvailabilityRule.active.is_(True),
                Venue.active.is_(True),
                Venue.verified.is_(True),
                Venue.latitude.is_not(None),
                Venue.longitude.is_not(None),
            )
            .order_by(VenueTableWindow.id)
            .limit(MAX_MATCH_CANDIDATE_ROWS_PER_KIND + 1)
        ).all()
        bounded_rows = require_bounded_candidate_rows(rows, kind="Venue")
        return [
            VenueCandidate(
                window_id=window.id,
                venue_id=venue.id,
                table_count=window.table_count,
                max_people_per_table=window.max_people_per_table,
                active=venue.active,
                verified=venue.verified,
                latitude=float(venue.latitude),
                longitude=float(venue.longitude),
                rule=copy_recurring_rule(rule),
            )
            for window, venue, rule in bounded_rows
            if venue.latitude is not None and venue.longitude is not None
        ]
    except Exception:
        LOGGER.exception("Failed to load bounded Venue match candidates")
        raise


__all__ = ["load_venue_candidates"]
