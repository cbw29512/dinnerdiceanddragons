"""Top-level production runner for deterministic Table Match generation."""

import logging
from collections.abc import Callable
from dataclasses import dataclass
from datetime import date

from sqlalchemy.orm import Session, sessionmaker

from app.db.session import get_session_factory
from app.services.game_table_match_materializer import (
    MaterializedGameTableResult,
    materialize_match_game_tables,
)
from app.services.geocodio_postal_resolver import GeocodioPostalCentroidResolver
from app.services.postal_centroid_cache import PostalCentroidCache
from app.services.postal_centroids import PostalCentroidResolver
from app.services.table_match_candidate_queries import load_match_candidate_snapshot
from app.services.table_match_engine import build_match_opportunities
from app.services.table_match_persistence_service import (
    PersistedMatchResult,
    persist_match_opportunities,
)
from app.services.table_match_reconciliation import expire_stale_potential_matches

LOGGER = logging.getLogger(__name__)
SessionFactory = Callable[[], Session]


@dataclass(frozen=True, slots=True)
class TableMatchRunResult:
    """Summary of one bounded production matcher run."""

    computed_opportunities: int
    persisted: tuple[PersistedMatchResult, ...]
    materialized_tables: tuple[MaterializedGameTableResult, ...] = ()
    expired_count: int = 0


def run_table_match(
    *,
    window_start: date,
    window_end: date,
    session_factory: SessionFactory | sessionmaker[Session] | None = None,
    postal_resolver: PostalCentroidResolver | None = None,
) -> TableMatchRunResult:
    """Load inputs, compute outside the read transaction, persist, and materialize Tables."""

    factory = session_factory or get_session_factory()
    try:
        with factory() as session:
            snapshot = load_match_candidate_snapshot(session)
    except Exception:
        LOGGER.exception("Table Match candidate loading failed")
        raise

    resolver = postal_resolver
    if resolver is None:
        resolver = PostalCentroidCache(
            GeocodioPostalCentroidResolver(),
            session_factory=factory,
        )

    try:
        opportunities = build_match_opportunities(
            snapshot,
            postal_resolver=resolver,
            window_start=window_start,
            window_end=window_end,
        )
        persisted = persist_match_opportunities(
            opportunities,
            session_factory=factory,
        )
        materialized_tables = materialize_match_game_tables(
            (item.table_match_id for item in persisted),
            session_factory=factory,
        )
        expired_count = expire_stale_potential_matches(
            opportunities,
            window_start=window_start,
            window_end=window_end,
            session_factory=factory,
        )
    except Exception:
        LOGGER.exception("Table Match computation, persistence, or materialization failed")
        raise

    return TableMatchRunResult(
        computed_opportunities=len(opportunities),
        persisted=persisted,
        materialized_tables=materialized_tables,
        expired_count=expired_count,
    )


__all__ = ["TableMatchRunResult", "run_table_match"]
