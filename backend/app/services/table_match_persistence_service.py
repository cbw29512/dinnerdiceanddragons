"""Duplicate-safe persistence for computed Table Match opportunities."""

import logging
from collections.abc import Callable, Iterable
from dataclasses import dataclass
from decimal import Decimal
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker

from app.db.session import get_session_factory
from app.models.match_explanation import MatchExplanation
from app.models.table_match import TableMatch, TableMatchStatus
from app.models.table_match_player import TableMatchPlayer
from app.services.table_match_opportunity import MatchOpportunity
from app.services.table_match_persistence_rows import (
    build_explanation_rows,
    build_player_rows,
)

LOGGER = logging.getLogger(__name__)
SessionFactory = Callable[[], Session]
REFRESHABLE_STATUSES = {
    TableMatchStatus.POTENTIAL.value,
    TableMatchStatus.EXPIRED.value,
}


@dataclass(frozen=True, slots=True)
class PersistedMatchResult:
    """Outcome of persisting or preserving one computed opportunity."""

    table_match_id: UUID
    created: bool
    refreshed: bool


def persist_match_opportunities(
    opportunities: Iterable[MatchOpportunity],
    *,
    session_factory: SessionFactory | sessionmaker[Session] | None = None,
) -> tuple[PersistedMatchResult, ...]:
    """Persist each opportunity without duplicating unchanged occurrences."""

    factory = session_factory or get_session_factory()
    return tuple(_persist_one(opportunity, factory) for opportunity in opportunities)


def _persist_one(
    opportunity: MatchOpportunity,
    session_factory: SessionFactory | sessionmaker[Session],
) -> PersistedMatchResult:
    with session_factory() as session:
        match = _load_existing(session, opportunity)
        created = match is None
        if match is None:
            match = _new_match(opportunity)
            session.add(match)
            try:
                session.flush()
            except IntegrityError:
                session.rollback()
                match = _load_existing(session, opportunity)
                if match is None:
                    LOGGER.exception("Table Match unique-key recovery failed")
                    raise
                created = False

        if match.status not in REFRESHABLE_STATUSES:
            return PersistedMatchResult(
                table_match_id=match.id,
                created=False,
                refreshed=False,
            )

        match.status = TableMatchStatus.POTENTIAL.value
        _refresh_match(match, opportunity)
        session.execute(delete(TableMatchPlayer).where(TableMatchPlayer.table_match_id == match.id))
        session.execute(delete(MatchExplanation).where(MatchExplanation.table_match_id == match.id))
        session.add_all(build_player_rows(match.id, opportunity))
        session.add_all(build_explanation_rows(match.id, opportunity))

        try:
            session.commit()
        except Exception:
            session.rollback()
            LOGGER.exception("Table Match persistence failed")
            raise

        return PersistedMatchResult(
            table_match_id=match.id,
            created=created,
            refreshed=True,
        )


def _load_existing(session: Session, opportunity: MatchOpportunity) -> TableMatch | None:
    return session.scalar(
        select(TableMatch).where(
            TableMatch.gm_supply_signal_id == opportunity.gm_supply_signal_id,
            TableMatch.venue_table_window_id == opportunity.venue_table_window_id,
            TableMatch.proposed_start == opportunity.proposed_start,
            TableMatch.proposed_end == opportunity.proposed_end,
        )
    )


def _new_match(opportunity: MatchOpportunity) -> TableMatch:
    return TableMatch(
        gm_supply_signal_id=opportunity.gm_supply_signal_id,
        venue_table_window_id=opportunity.venue_table_window_id,
        game_system_id=opportunity.game_system_id,
        proposed_start=opportunity.proposed_start,
        proposed_end=opportunity.proposed_end,
        timezone=opportunity.timezone,
        minimum_players=opportunity.minimum_players,
        maximum_players=opportunity.maximum_players,
    )


def _refresh_match(match: TableMatch, opportunity: MatchOpportunity) -> None:
    match.game_system_id = opportunity.game_system_id
    match.timezone = opportunity.timezone
    match.minimum_players = opportunity.minimum_players
    match.maximum_players = opportunity.maximum_players
    match.compatible_player_count = opportunity.compatible_player_count
    match.distance_summary = opportunity.distance_summary
    match.fit_score = Decimal("0.00")


__all__ = ["PersistedMatchResult", "persist_match_opportunities"]
