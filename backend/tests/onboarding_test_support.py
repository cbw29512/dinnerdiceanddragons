"""Shared HTTP-test support for authenticated onboarding and matching endpoints."""

from uuid import UUID

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.dependencies.auth import get_supabase_jwt_verifier
from app.auth.supabase_jwt import TokenVerificationError
from app.db.session import get_db_session
from app.main import create_app
from app.models.availability_window import GMAvailabilityWindow, PlayerAvailabilityWindow
from app.models.event import Event
from app.models.game_series import GameSeries
from app.models.game_system import GameSystem
from app.models.gm_profile import GMProfile
from app.models.gm_supply_signal import GMSupplySignal
from app.models.gm_system_experience import GMSystemExperience, GMSystemFormat
from app.models.match_explanation import MatchExplanation
from app.models.player_demand_signal import PlayerDemandSignal
from app.models.player_profile import PlayerProfile
from app.models.player_system_experience import PlayerSystemExperience
from app.models.postal_code_centroid import PostalCodeCentroid
from app.models.privileged_audit_event import PrivilegedAuditEvent
from app.models.recurring_availability_rule import RecurringAvailabilityRule
from app.models.registration import Registration
from app.models.table_expectations import TableExpectations
from app.models.table_match import TableMatch
from app.models.table_match_player import TableMatchPlayer
from app.models.user import User
from app.models.user_role import UserRole
from app.models.venue import Venue, VenueManager
from app.models.venue_booking_request import VenueBookingRequest
from app.models.venue_table_window import VenueTableWindow

ALICE_SUBJECT = "11111111-1111-1111-1111-111111111111"
BOB_SUBJECT = "22222222-2222-2222-2222-222222222222"


class StubVerifier:
    """Return deterministic verified identities for Alice and Bob test tokens."""

    def verify(self, token: str):
        try:
            identities = {
                "alice-token": (ALICE_SUBJECT, "alice@example.com"),
                "bob-token": (BOB_SUBJECT, "bob@example.com"),
            }
            subject, email = identities[token]
        except KeyError as exc:
            raise TokenVerificationError("invalid test token") from exc
        return {
            "sub": subject,
            "email": email,
            "aud": "authenticated",
            "iss": "https://example.supabase.co/auth/v1",
            "exp": 4102444800,
            "role": "authenticated",
            "is_anonymous": False,
        }


def build_onboarding_client():
    """Build an isolated API client and session factory with current production tables."""

    try:
        engine = create_engine(
            "sqlite+pysqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )

        @event.listens_for(engine, "connect")
        def enable_foreign_keys(dbapi_connection: object, _: object) -> None:
            cursor = dbapi_connection.cursor()  # type: ignore[attr-defined]
            try:
                cursor.execute("PRAGMA foreign_keys=ON")
            finally:
                cursor.close()

        for table in (
            User.__table__,
            UserRole.__table__,
            PlayerProfile.__table__,
            GMProfile.__table__,
            Venue.__table__,
            VenueManager.__table__,
            GameSystem.__table__,
            PlayerSystemExperience.__table__,
            GMSystemExperience.__table__,
            GMSystemFormat.__table__,
            RecurringAvailabilityRule.__table__,
            PlayerAvailabilityWindow.__table__,
            GMAvailabilityWindow.__table__,
            PlayerDemandSignal.__table__,
            GMSupplySignal.__table__,
            VenueTableWindow.__table__,
            TableMatch.__table__,
            TableMatchPlayer.__table__,
            MatchExplanation.__table__,
            PostalCodeCentroid.__table__,
            GameSeries.__table__,
            Event.__table__,
            TableExpectations.__table__,
            Registration.__table__,
            VenueBookingRequest.__table__,
            PrivilegedAuditEvent.__table__,
        ):
            table.create(engine)

        factory = sessionmaker(
            bind=engine,
            class_=Session,
            expire_on_commit=False,
        )
        with factory() as session:
            session.add_all(
                [
                    GameSystem(
                        id=UUID("10000000-0000-0000-0000-000000000001"),
                        name="Dungeons & Dragons",
                        edition="5e (2014)",
                        slug="dnd-5e-2014",
                    ),
                    GameSystem(
                        id=UUID("10000000-0000-0000-0000-000000000003"),
                        name="Pathfinder",
                        edition="2e",
                        slug="pathfinder-2e",
                    ),
                ]
            )
            session.commit()

        application = create_app()
        application.dependency_overrides[get_supabase_jwt_verifier] = lambda: StubVerifier()

        def override_db_session():
            session = factory()
            try:
                yield session
            finally:
                session.close()

        application.dependency_overrides[get_db_session] = override_db_session
        return TestClient(application), factory, engine
    except Exception:
        raise
