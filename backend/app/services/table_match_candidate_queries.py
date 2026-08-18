"""Bounded coordinator for production Table Match candidate snapshots."""

import logging

from sqlalchemy.orm import Session

from app.services.table_match_candidate_types import MatchCandidateSnapshot
from app.services.table_match_gm_candidates import load_gm_candidates
from app.services.table_match_player_candidates import load_player_candidates
from app.services.table_match_venue_candidates import load_venue_candidates

LOGGER = logging.getLogger(__name__)


def load_match_candidate_snapshot(session: Session) -> MatchCandidateSnapshot:
    """Load bounded detached candidate sets for computation outside the DB."""

    try:
        return MatchCandidateSnapshot(
            gms=tuple(load_gm_candidates(session)),
            venues=tuple(load_venue_candidates(session)),
            players=tuple(load_player_candidates(session)),
        )
    except Exception:
        LOGGER.exception("Failed to build bounded Table Match candidate snapshot")
        raise


__all__ = ["load_match_candidate_snapshot"]
