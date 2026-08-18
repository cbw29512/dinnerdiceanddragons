"""Registration tests for persistent GameTable membership synchronization."""

from game_table_lifecycle_test_support import table_aware_factory
from sqlalchemy import select

from app.models.event import Event
from app.models.game_table import GameTable, GameTableStatus
from app.models.game_table_player import GameTablePlayer, GameTablePlayerStatus
from app.services.gm_registration_service import decide_registration
from app.services.player_registration_service import cancel_registration, request_registration


def test_waitlist_replaces_pre_first_play_commitment() -> None:
    factory, seed, table_id = table_aware_factory(player_count=2)

    with factory() as session:
        request_registration(session, seed.player_users[0], seed.event_id)
    with factory() as session:
        request_registration(session, seed.player_users[1], seed.event_id)

    with factory() as session:
        first_member = session.get(
            GameTablePlayer,
            (table_id, seed.player_profiles[0].id),
        )
        second_member = session.get(
            GameTablePlayer,
            (table_id, seed.player_profiles[1].id),
        )
        game_table = session.get(GameTable, table_id)
        assert first_member is not None and second_member is not None
        assert game_table is not None
        assert first_member.status == GameTablePlayerStatus.CONFIRMED.value
        assert second_member.status == GameTablePlayerStatus.INVITED.value
        assert game_table.lifecycle_status == GameTableStatus.CONFIRMED.value

    with factory() as session:
        cancel_registration(session, seed.player_users[0], seed.event_id)

    with factory() as session:
        first_member = session.get(
            GameTablePlayer,
            (table_id, seed.player_profiles[0].id),
        )
        second_member = session.get(
            GameTablePlayer,
            (table_id, seed.player_profiles[1].id),
        )
        assert first_member is not None and second_member is not None
        assert first_member.status == GameTablePlayerStatus.INVITED.value
        assert second_member.status == GameTablePlayerStatus.CONFIRMED.value


def test_gm_confirmation_promotes_invitation_to_persistent_membership() -> None:
    factory, seed, table_id = table_aware_factory(player_count=1)
    with factory() as session:
        event = session.get(Event, seed.event_id)
        assert event is not None
        event.join_mode = "request_to_join"
        session.commit()

    with factory() as session:
        requested = request_registration(session, seed.player_users[0], seed.event_id)
        member = session.get(
            GameTablePlayer,
            (table_id, seed.player_profiles[0].id),
        )
        assert member is not None
        assert member.status == GameTablePlayerStatus.INVITED.value

    with factory() as session:
        decide_registration(session, seed.gm_user, seed.event_id, requested.id, "confirm")
        member = session.get(
            GameTablePlayer,
            (table_id, seed.player_profiles[0].id),
        )
        game_table = session.get(GameTable, table_id)
        assert member is not None and game_table is not None
        assert member.status == GameTablePlayerStatus.CONFIRMED.value
        assert game_table.lifecycle_status == GameTableStatus.CONFIRMED.value
        assert session.scalar(
            select(GameTablePlayer.player_profile_id).where(
                GameTablePlayer.game_table_id == table_id
            )
        ) == seed.player_profiles[0].id
