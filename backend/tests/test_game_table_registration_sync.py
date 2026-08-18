"""Registration tests for persistent GameTable membership synchronization."""

from uuid import UUID

from event_lifecycle_test_support import LifecycleSeed, build_lifecycle_factory
from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from app.models.event import Event
from app.models.game_table import GameTable, GameTableStatus
from app.models.game_table_player import GameTablePlayer, GameTablePlayerStatus
from app.models.gm_supply_signal import GMSupplySignal
from app.models.table_match import TableMatch
from app.models.venue_table_window import VenueTableWindow
from app.services.gm_registration_service import decide_registration
from app.services.player_registration_service import cancel_registration, request_registration


def table_aware_factory(
    *,
    player_count: int,
) -> tuple[sessionmaker[Session], LifecycleSeed, UUID]:
    """Extend the existing lifecycle fixture with one persistent forming Table."""

    try:
        factory, seed = build_lifecycle_factory(player_count=player_count)
        with factory() as session:
            event = session.get(Event, seed.event_id)
            match = session.get(TableMatch, seed.match_id)
            assert event is not None and match is not None
            supply = session.get(GMSupplySignal, match.gm_supply_signal_id)
            window = session.get(VenueTableWindow, match.venue_table_window_id)
            assert supply is not None and window is not None

            game_table = GameTable(
                game_system_id=match.game_system_id,
                created_by_user_id=seed.gm_user.id,
                source_table_match_id=match.id,
                title=event.title,
                lifecycle_status=GameTableStatus.FORMING.value,
                game_format=supply.preferred_format,
                minimum_players=event.min_players,
                maximum_players=event.max_players,
                gm_profile_id=event.gm_profile_id,
                venue_id=event.venue_id,
                venue_table_window_id=window.id,
                proposed_start=event.starts_at,
                proposed_end=event.ends_at,
                timezone=match.timezone,
            )
            session.add(game_table)
            session.flush()
            event.game_table_id = game_table.id
            session.add_all(
                GameTablePlayer(
                    game_table_id=game_table.id,
                    player_profile_id=profile.id,
                    source_player_demand_signal_id=demand.id,
                    status=GameTablePlayerStatus.INVITED.value,
                )
                for profile, demand in zip(
                    seed.player_profiles,
                    seed.player_demands,
                    strict=True,
                )
            )
            session.commit()
            return factory, seed, game_table.id
    except Exception:
        raise


def test_waitlist_replaces_pre_first_play_commitment() -> None:
    factory, seed, table_id = table_aware_factory(player_count=2)

    with factory() as session:
        request_registration(session, seed.player_users[0], seed.event_id)
    with factory() as session:
        request_registration(session, seed.player_users[1], seed.event_id)

    with factory() as session:
        first_member = session.get(GameTablePlayer, (table_id, seed.player_profiles[0].id))
        second_member = session.get(GameTablePlayer, (table_id, seed.player_profiles[1].id))
        game_table = session.get(GameTable, table_id)
        assert first_member is not None and second_member is not None
        assert game_table is not None
        assert first_member.status == GameTablePlayerStatus.CONFIRMED.value
        assert second_member.status == GameTablePlayerStatus.INVITED.value
        assert game_table.lifecycle_status == GameTableStatus.CONFIRMED.value

    with factory() as session:
        cancel_registration(session, seed.player_users[0], seed.event_id)

    with factory() as session:
        first_member = session.get(GameTablePlayer, (table_id, seed.player_profiles[0].id))
        second_member = session.get(GameTablePlayer, (table_id, seed.player_profiles[1].id))
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
        member = session.get(GameTablePlayer, (table_id, seed.player_profiles[0].id))
        assert member is not None
        assert member.status == GameTablePlayerStatus.INVITED.value

    with factory() as session:
        decide_registration(session, seed.gm_user, seed.event_id, requested.id, "confirm")
        member = session.get(GameTablePlayer, (table_id, seed.player_profiles[0].id))
        game_table = session.get(GameTable, table_id)
        assert member is not None and game_table is not None
        assert member.status == GameTablePlayerStatus.CONFIRMED.value
        assert game_table.lifecycle_status == GameTableStatus.CONFIRMED.value
        assert session.scalar(
            select(GameTablePlayer.player_profile_id).where(
                GameTablePlayer.game_table_id == table_id
            )
        ) == seed.player_profiles[0].id
