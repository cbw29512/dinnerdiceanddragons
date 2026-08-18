"""Role-scoped reads for persisted Table Match opportunities."""

import logging
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.models.game_system import GameSystem
from app.models.match_explanation import MatchExplanation
from app.models.table_match import TableMatch
from app.models.user import User
from app.models.venue import Venue
from app.schemas.table_match_opportunities import (
    OpportunityExplanationResponse,
    OpportunitySystemResponse,
    OpportunityVenueResponse,
    TableMatchOpportunityDetailResponse,
    TableMatchOpportunityResponse,
)
from app.services.query_limits import MAX_MATCH_OPPORTUNITY_LIST_ITEMS
from app.services.table_match_access_query import opportunity_query, user_roles
from app.services.table_match_viewer_context import viewer_facts

LOGGER = logging.getLogger(__name__)


class TableMatchOpportunityNotFoundError(LookupError):
    """The requested opportunity is absent or inaccessible to the caller."""


class TableMatchOpportunityReadError(RuntimeError):
    """Persisted opportunity data could not be loaded safely."""


def list_opportunities(session: Session, user: User) -> list[TableMatchOpportunityResponse]:
    """Return a bounded set of matches reachable through the caller's durable roles."""

    try:
        roles = user_roles(session, user.id)
        rows = session.execute(
            opportunity_query(user.id, roles)
            .order_by(TableMatch.proposed_start, TableMatch.id)
            .limit(MAX_MATCH_OPPORTUNITY_LIST_ITEMS)
        ).all()
        return [_summary_response(session, user.id, roles, *row) for row in rows]
    except SQLAlchemyError as exc:
        LOGGER.exception("Failed to list role-safe Table Match opportunities")
        raise TableMatchOpportunityReadError("Matching opportunities could not be loaded.") from exc


def get_opportunity(
    session: Session,
    user: User,
    table_match_id: UUID,
) -> TableMatchOpportunityDetailResponse:
    """Return one explainable match only when the caller has resource access."""

    try:
        roles = user_roles(session, user.id)
        row = session.execute(
            opportunity_query(user.id, roles).where(TableMatch.id == table_match_id)
        ).one_or_none()
        if row is None:
            raise TableMatchOpportunityNotFoundError("Matching opportunity was not found.")

        summary = _summary_response(session, user.id, roles, *row)
        viewer = viewer_facts(session, user.id, roles, row[0])
        explanations = session.scalars(
            select(MatchExplanation)
            .where(MatchExplanation.table_match_id == table_match_id)
            .order_by(MatchExplanation.criterion)
        ).all()
        return TableMatchOpportunityDetailResponse(
            **summary.model_dump(),
            your_player_fit_flags=list(viewer.player_fit_flags),
            your_player_availability_overlap=viewer.player_overlap,
            explanations=[
                OpportunityExplanationResponse(
                    criterion=item.criterion,
                    result=item.result,
                    summary=item.summary,
                )
                for item in explanations
            ],
        )
    except TableMatchOpportunityNotFoundError:
        raise
    except SQLAlchemyError as exc:
        LOGGER.exception("Failed to load role-safe Table Match opportunity %s", table_match_id)
        raise TableMatchOpportunityReadError("Matching opportunity could not be loaded.") from exc


def _summary_response(
    session: Session,
    user_id: UUID,
    roles: frozenset[str],
    match: TableMatch,
    system: GameSystem,
    venue: Venue,
) -> TableMatchOpportunityResponse:
    viewer = viewer_facts(session, user_id, roles, match)
    return TableMatchOpportunityResponse(
        id=match.id,
        status=match.status,
        proposed_start=match.proposed_start,
        proposed_end=match.proposed_end,
        timezone=match.timezone,
        minimum_players=match.minimum_players,
        maximum_players=match.maximum_players,
        compatible_player_count=match.compatible_player_count,
        system=OpportunitySystemResponse(
            slug=system.slug,
            name=system.name,
            edition=system.edition,
        ),
        venue=OpportunityVenueResponse(
            id=venue.id,
            name=venue.name,
            city=venue.city,
            state_region=venue.state_region,
        ),
        viewer_roles=list(viewer.roles),
        your_player_distance_miles=viewer.player_distance_miles,
        your_gm_distance_miles=viewer.gm_distance_miles,
    )


__all__ = [
    "TableMatchOpportunityNotFoundError",
    "TableMatchOpportunityReadError",
    "get_opportunity",
    "list_opportunities",
]
