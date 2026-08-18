"""Unit contracts proving bounded list queries emit SQL LIMIT clauses."""

from types import SimpleNamespace
from uuid import uuid4

from sqlalchemy import select

from app.models.table_match import TableMatch
from app.services import gm_supply, player_demand, table_match_opportunity_reads, venue_table_windows
from app.services.query_limits import (
    MAX_MATCH_OPPORTUNITY_LIST_ITEMS,
    MAX_OWNER_MATCHING_SIGNAL_ITEMS,
)


class _EmptyResult:
    def all(self) -> list[object]:
        return []


class _CaptureSession:
    def __init__(self) -> None:
        self.statement = None

    def execute(self, statement):
        self.statement = statement
        return _EmptyResult()


def _assert_limit(statement, expected: int) -> None:
    assert statement is not None
    compiled = statement.compile()
    assert "LIMIT" in str(compiled).upper()
    assert expected in compiled.params.values()


def test_player_demand_history_query_is_bounded(monkeypatch) -> None:
    session = _CaptureSession()
    user = SimpleNamespace(id=uuid4())
    monkeypatch.setattr(
        player_demand,
        "require_player_profile",
        lambda *_args: SimpleNamespace(id=uuid4()),
    )

    assert player_demand.list_player_demands(session, user) == []  # type: ignore[arg-type]
    _assert_limit(session.statement, MAX_OWNER_MATCHING_SIGNAL_ITEMS)


def test_gm_supply_history_query_is_bounded(monkeypatch) -> None:
    session = _CaptureSession()
    user = SimpleNamespace(id=uuid4())
    monkeypatch.setattr(
        gm_supply,
        "require_gm_profile",
        lambda *_args: SimpleNamespace(id=uuid4()),
    )

    assert gm_supply.list_gm_supplies(session, user) == []  # type: ignore[arg-type]
    _assert_limit(session.statement, MAX_OWNER_MATCHING_SIGNAL_ITEMS)


def test_venue_table_window_query_is_bounded(monkeypatch) -> None:
    session = _CaptureSession()
    user = SimpleNamespace(id=uuid4())
    monkeypatch.setattr(venue_table_windows, "require_verified_venue_manager", lambda *_args: None)

    assert venue_table_windows.list_venue_table_windows(  # type: ignore[arg-type]
        session,
        user,
        uuid4(),
    ) == []
    _assert_limit(session.statement, MAX_OWNER_MATCHING_SIGNAL_ITEMS)


def test_table_match_opportunity_list_query_is_bounded(monkeypatch) -> None:
    session = _CaptureSession()
    user = SimpleNamespace(id=uuid4())
    monkeypatch.setattr(table_match_opportunity_reads, "user_roles", lambda *_args: frozenset())
    monkeypatch.setattr(
        table_match_opportunity_reads,
        "opportunity_query",
        lambda *_args: select(TableMatch),
    )

    assert table_match_opportunity_reads.list_opportunities(  # type: ignore[arg-type]
        session,
        user,
    ) == []
    _assert_limit(session.statement, MAX_MATCH_OPPORTUNITY_LIST_ITEMS)
