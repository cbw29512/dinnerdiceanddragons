"""Idempotently materialize persistent GameTables for viable persisted matches."""

import logging
from collections.abc import Callable, Iterable
from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker

from app.db.session import get_session_factory
from app.models.game_table import GameTable
from app.models.table_match import TableMatch, TableMatchStatus
from app.services.game_table_from_match import materialize_game_table_from_match
from app.services.table_formation_builders import load_formation_parents

LOGGER = logging.getLogger(__name__)
SessionFactory = Callable[[], Session]


@dataclass(frozen=True, slots=True)
class MaterializedGameTableResult:
    table_match_id: UUID
    game_table_id: UUID
    created: bool


def materialize_match_game_tables(
    table_match_ids: Iterable[UUID],
    *,
    session_factory: SessionFactory | sessionmaker[Session] | None = None,
) -> tuple[MaterializedGameTableResult, ...]:
    """Create the BOOM-stage Table for every current hard-fit match."""

    factory = session_factory or get_session_factory()
    results: list[MaterializedGameTableResult] = []
    for table_match_id in dict.fromkeys(table_match_ids):
        result = _materialize_one(table_match_id, factory)
        if result is not None:
            results.append(result)
    return tuple(results)


def _materialize_one(
    table_match_id: UUID,
    factory: SessionFactory | sessionmaker[Session],
) -> MaterializedGameTableResult | None:
    with factory() as session:
        match = session.get(TableMatch, table_match_id)
        if match is None or match.status != TableMatchStatus.POTENTIAL.value:
            return None

        existing = session.scalar(
            select(GameTable).where(GameTable.source_table_match_id == table_match_id)
        )
        created = existing is None
        try:
            parents = load_formation_parents(session, match)
            game_table = materialize_game_table_from_match(session, match, parents)
            session.commit()
            return MaterializedGameTableResult(
                table_match_id=match.id,
                game_table_id=game_table.id,
                created=created,
            )
        except IntegrityError:
            # A concurrent matcher may have won the unique source-match race.
            session.rollback()
            recovered = session.scalar(
                select(GameTable).where(GameTable.source_table_match_id == table_match_id)
            )
            if recovered is None:
                LOGGER.exception(
                    "GameTable materialization unique-key recovery failed match_id=%s",
                    table_match_id,
                )
                raise
            return MaterializedGameTableResult(
                table_match_id=table_match_id,
                game_table_id=recovered.id,
                created=False,
            )
        except Exception:
            session.rollback()
            LOGGER.exception("GameTable materialization failed match_id=%s", table_match_id)
            raise


__all__ = ["MaterializedGameTableResult", "materialize_match_game_tables"]
