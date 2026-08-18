"""Reusable SQLite fixture for seat, headcount, and waitlist tests."""

from event_lifecycle_seed_data import LifecycleSeed, seed_lifecycle_inputs
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.models.event import Event
from app.models.game_system import GameSystem
from app.models.game_table import GameTable
from app.models.game_table_player import GameTablePlayer
from app.models.gm_profile import GMProfile
from app.models.gm_supply_signal import GMSupplySignal
from app.models.player_demand_signal import PlayerDemandSignal
from app.models.player_profile import PlayerProfile
from app.models.recurring_availability_rule import RecurringAvailabilityRule
from app.models.registration import Registration
from app.models.table_match import TableMatch
from app.models.table_match_player import TableMatchPlayer
from app.models.user import User
from app.models.user_role import UserRole
from app.models.venue import Venue
from app.models.venue_booking_request import VenueBookingRequest
from app.models.venue_table_window import VenueTableWindow


def build_lifecycle_factory(
    *,
    player_count: int = 2,
) -> tuple[sessionmaker[Session], LifecycleSeed]:
    """Create an isolated database containing the production lifecycle tables."""

    try:
        engine = create_engine("sqlite+pysqlite:///:memory:", poolclass=StaticPool)
        for table in (
            User.__table__,
            UserRole.__table__,
            PlayerProfile.__table__,
            GMProfile.__table__,
            Venue.__table__,
            GameSystem.__table__,
            RecurringAvailabilityRule.__table__,
            PlayerDemandSignal.__table__,
            GMSupplySignal.__table__,
            VenueTableWindow.__table__,
            TableMatch.__table__,
            TableMatchPlayer.__table__,
            GameTable.__table__,
            GameTablePlayer.__table__,
            Event.__table__,
            Registration.__table__,
            VenueBookingRequest.__table__,
        ):
            table.create(engine)
        factory = sessionmaker(
            bind=engine,
            class_=Session,
            autoflush=False,
            expire_on_commit=False,
        )
        with factory() as session:
            seed = seed_lifecycle_inputs(session, player_count)
            session.commit()
        return factory, seed
    except Exception:
        raise


__all__ = ["LifecycleSeed", "build_lifecycle_factory"]
