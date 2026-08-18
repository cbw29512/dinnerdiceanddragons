"""Reconcile persisted potential matches with one fresh bounded matcher run."""

import logging
from collections.abc import Callable, Iterable
from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from app.db.session import get_session_factory
from app.models.table_match import TableMatch, TableMatchStatus
from app.services.table_match_opportunity import MatchOpportunity

LOGGER = logging.getLogger(__name__)
SessionFactory = Callable[[], Session]


def expire_stale_potential_matches(
    opportunities: Iterable[MatchOpportunity],
    *,
    window_start: date,
    window_end: date,
    session_factory: SessionFactory | sessionmaker[Session] | None = None,
) -> int:
    """Expire potential matches in the run horizon that are no longer produced."""

    active_keys = {_key_from_opportunity(item) for item in opportunities}
    lower = datetime.combine(window_start - timedelta(days=1), time.min, tzinfo=UTC)
    upper = datetime.combine(window_end + timedelta(days=2), time.min, tzinfo=UTC)
    factory = session_factory or get_session_factory()

    with factory() as session:
        matches = session.scalars(
            select(TableMatch).where(
                TableMatch.status == TableMatchStatus.POTENTIAL.value,
                TableMatch.proposed_start >= lower,
                TableMatch.proposed_start < upper,
            )
        ).all()
        expired = 0
        for match in matches:
            if not _inside_local_horizon(match, window_start, window_end):
                continue
            if _key_from_match(match) in active_keys:
                continue
            match.status = TableMatchStatus.EXPIRED.value
            expired += 1

        if expired:
            try:
                session.commit()
            except Exception:
                session.rollback()
                LOGGER.exception("Failed to expire stale Table Match potentials")
                raise
        return expired


def _inside_local_horizon(match: TableMatch, window_start: date, window_end: date) -> bool:
    try:
        zone = ZoneInfo(match.timezone)
    except (ZoneInfoNotFoundError, ValueError):
        LOGGER.warning("Skipping stale-match reconciliation for invalid timezone on %s", match.id)
        return False
    local_date = match.proposed_start.astimezone(zone).date()
    return window_start <= local_date <= window_end


def _key_from_opportunity(opportunity: MatchOpportunity) -> tuple[object, ...]:
    return (
        opportunity.gm_supply_signal_id,
        opportunity.venue_table_window_id,
        opportunity.proposed_start,
        opportunity.proposed_end,
    )


def _key_from_match(match: TableMatch) -> tuple[object, ...]:
    return (
        match.gm_supply_signal_id,
        match.venue_table_window_id,
        match.proposed_start,
        match.proposed_end,
    )


__all__ = ["expire_stale_potential_matches"]
