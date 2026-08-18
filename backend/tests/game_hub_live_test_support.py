"""Production-faithful authenticated fixture for live Game Hub API tests."""

from dataclasses import dataclass
from datetime import UTC, datetime, time
from uuid import UUID

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.dependencies.auth import get_supabase_jwt_verifier
from app.auth.supabase_jwt import TokenVerificationError
from app.db.session import get_db_session
from app.models import metadata
from app.models.event import Event
from app.models.game_system import GameSystem
from app.models.gm_profile import GMProfile
from app.models.message import Message
from app.models.player_profile import PlayerProfile
from app.models.recurring_availability_rule import RecurringAvailabilityRule
from app.models.registration import Registration
from app.models.table_expectations import TableExpectations
from app.models.user import AccountStatus, User
from app.models.user_role import UserRole, UserRoleType
from app.models.venue import Venue, VenueManager
from app.models.venue_booking_request import VenueBookingRequest
from app.models.venue_table_window import VenueTableWindow

IDENTITIES = {
    "alice-token": ("11111111-1111-1111-1111-111111111111", "alice@example.com", "Alice"),
    "bob-token": ("22222222-2222-2222-2222-222222222222", "bob@example.com", "DM Bob"),
    "carol-token": ("33333333-3333-3333-3333-333333333333", "carol@example.com", "Venue Carol"),
    "dave-token": ("44444444-4444-4444-4444-444444444444", "dave@example.com", "Dave"),
}


@dataclass(frozen=True, slots=True)
class LiveHubSeed:
    event_id: UUID
    alice_registration_id: UUID
    dave_registration_id: UUID


class HubVerifier:
    def verify(self, token: str):
        try:
            subject, email, _ = IDENTITIES[token]
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


def build_hub_client(routers: tuple) -> tuple[TestClient, sessionmaker[Session], object, LiveHubSeed]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(engine, "connect")
    def enable_foreign_keys(dbapi_connection: object, _: object) -> None:
        cursor = dbapi_connection.cursor()  # type: ignore[attr-defined]
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    metadata.create_all(engine)
    factory = sessionmaker(bind=engine, class_=Session, expire_on_commit=False)
    seed = _seed(factory)
    app = FastAPI()
    for router in routers:
        app.include_router(router, prefix="/api/v1")
    app.dependency_overrides[get_supabase_jwt_verifier] = lambda: HubVerifier()

    def override_db_session():
        session = factory()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db_session] = override_db_session
    return TestClient(app), factory, engine, seed


def _seed(factory: sessionmaker[Session]) -> LiveHubSeed:
    with factory() as session:
        users: dict[str, User] = {}
        for token, (subject, email, display_name) in IDENTITIES.items():
            del token
            user = User(
                auth_provider_user_id=subject,
                email=email,
                display_name=display_name,
                status=AccountStatus.ACTIVE.value,
            )
            session.add(user)
            session.flush()
            users[display_name] = user

        alice_user = users["Alice"]
        bob_user = users["DM Bob"]
        carol_user = users["Venue Carol"]
        dave_user = users["Dave"]
        session.add_all(
            [
                UserRole(user_id=bob_user.id, role=UserRoleType.GM.value),
                UserRole(user_id=alice_user.id, role=UserRoleType.PLAYER.value),
                UserRole(user_id=dave_user.id, role=UserRoleType.PLAYER.value),
                UserRole(user_id=carol_user.id, role=UserRoleType.VENUE_MANAGER.value),
            ]
        )
        system = GameSystem(name="Dungeons & Dragons", edition="5e (2014)", slug="hub-dnd-5e-2014")
        venue = Venue(
            name="Live Hub Cafe",
            slug="live-hub-cafe",
            venue_type="cafe",
            address_line1="123 Public Way",
            city="Florence",
            state_region="SC",
            postal_code="29501",
            latitude=34.1954,
            longitude=-79.7626,
            verified=True,
        )
        rule = RecurringAvailabilityRule(
            day_of_week="friday",
            start_time=time(18),
            end_time=time(22),
            pattern_type="weekly_interval",
            week_interval=1,
            timezone="America/New_York",
        )
        session.add_all([system, venue, rule])
        session.flush()
        gm = GMProfile(
            user_id=bob_user.id,
            postal_code="29501",
            travel_radius_miles=25,
            gm_style="Collaborative.",
        )
        alice = PlayerProfile(user_id=alice_user.id, postal_code="29501", travel_radius_miles=25)
        dave = PlayerProfile(user_id=dave_user.id, postal_code="29501", travel_radius_miles=25)
        session.add_all([gm, alice, dave])
        session.flush()
        session.add(
            VenueManager(
                venue_id=venue.id,
                user_id=carol_user.id,
                role="manager",
                verified_at=datetime.now(UTC),
            )
        )
        window = VenueTableWindow(
            venue_id=venue.id,
            recurring_rule_id=rule.id,
            table_count=1,
            max_people_per_table=3,
            approval_required=True,
        )
        session.add(window)
        session.flush()
        event_row = Event(
            slug="live-hub-test",
            title="Live Hub Night",
            description="Live Hub test Event.",
            gm_profile_id=gm.id,
            game_system_id=system.id,
            venue_id=venue.id,
            event_type="one_shot",
            join_mode="instant_join",
            status="full",
            starts_at=datetime(2030, 8, 23, 22, tzinfo=UTC),
            ends_at=datetime(2030, 8, 24, 2, tzinfo=UTC),
            min_players=1,
            max_players=2,
        )
        session.add(event_row)
        session.flush()
        expectations = TableExpectations(
            event_id=event_row.id,
            play_style="Collaborative.",
            boundaries="Respectful table.",
        )
        alice_reg = Registration(
            event_id=event_row.id,
            player_profile_id=alice.id,
            status="confirmed",
            expectations_acknowledged_at=datetime.now(UTC),
        )
        dave_reg = Registration(
            event_id=event_row.id,
            player_profile_id=dave.id,
            status="confirmed",
            expectations_acknowledged_at=datetime.now(UTC),
        )
        session.add_all([expectations, alice_reg, dave_reg])
        session.flush()
        session.add(
            VenueBookingRequest(
                venue_table_window_id=window.id,
                gm_profile_id=gm.id,
                event_id=event_row.id,
                requested_start=event_row.starts_at,
                requested_end=event_row.ends_at,
                tables_requested=1,
                expected_guests=3,
                status="approved",
            )
        )
        session.commit()
        return LiveHubSeed(event_row.id, alice_reg.id, dave_reg.id)


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


__all__ = ["LiveHubSeed", "auth", "build_hub_client"]
