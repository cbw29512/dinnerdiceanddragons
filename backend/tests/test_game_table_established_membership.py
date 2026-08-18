"""Regression tests for established persistent GameTable membership."""

from datetime import timedelta

from game_table_lifecycle_test_support import table_aware_factory

from app.models.event import Event, EventStatus
from app.models.game_table import GameTable, GameTableStatus
from app.models.game_table_player import GameTablePlayer, GameTablePlayerStatus
from app.services.player_registration_service import cancel_registration, request_registration


def test_established_member_survives_later_event_cancellation() -> None:
    """One missed later session must not eject a Player from an established Table."""

    try:
        factory, seed, table_id = table_aware_factory(player_count=1)
        with factory() as session:
            request_registration(session, seed.player_users[0], seed.event_id)

        with factory() as session:
            current = session.get(Event, seed.event_id)
            assert current is not None
            historical = Event(
                game_table_id=table_id,
                slug="established-table-history",
                title=current.title,
                description="Completed prior session establishing durable membership.",
                gm_profile_id=current.gm_profile_id,
                game_system_id=current.game_system_id,
                venue_id=current.venue_id,
                event_type=current.event_type,
                join_mode=current.join_mode,
                status=EventStatus.COMPLETED.value,
                starts_at=current.starts_at - timedelta(days=7),
                ends_at=current.ends_at - timedelta(days=7),
                min_players=current.min_players,
                max_players=current.max_players,
            )
            session.add(historical)
            session.commit()

        with factory() as session:
            cancel_registration(session, seed.player_users[0], seed.event_id)

        with factory() as session:
            membership = session.get(
                GameTablePlayer,
                (table_id, seed.player_profiles[0].id),
            )
            game_table = session.get(GameTable, table_id)
            assert membership is not None and game_table is not None
            assert membership.status == GameTablePlayerStatus.CONFIRMED.value
            assert game_table.lifecycle_status == GameTableStatus.CONFIRMED.value
    except Exception:
        raise
