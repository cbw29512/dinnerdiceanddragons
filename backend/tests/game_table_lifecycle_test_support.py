"""Reusable persistent GameTable fixture layered onto Event lifecycle tests."""

from uuid import UUID

from event_lifecycle_test_support import LifecycleSeed, build_lifecycle_factory
from sqlalchemy.orm import Session, sessionmaker

from app.models.event import Event
from app.models.game_table import GameTable, GameTableStatus
from app.models.game_table_player import GameTablePlayer, GameTablePlayerStatus
from app.models.gm_supply_signal import GMSupplySignal
from app.models.table_match import TableMatch
from app.models.venue_table_window import VenueTableWindow


def table_aware_factory(
    *,
    player_count: int,
) -> tuple[sessionmaker[Session], LifecycleSeed, UUID]:
    """Attach one forming persistent Table and invitations to a lifecycle fixture."""

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


__all__ = ["table_aware_factory"]
