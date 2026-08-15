"""Tests for durable Venue and VenueManager persistence invariants."""

from datetime import UTC, datetime

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.dependencies.venue_access import require_verified_venue_relationship
from app.models.gm_profile import GMProfile
from app.models.player_profile import PlayerProfile
from app.models.user import AccountStatus, User
from app.models.user_role import UserRole, UserRoleType
from app.models.venue import Venue, VenueManager, VenueManagerRole, VenueType


def make_session() -> Session:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    User.__table__.create(engine)
    UserRole.__table__.create(engine)
    PlayerProfile.__table__.create(engine)
    GMProfile.__table__.create(engine)
    Venue.__table__.create(engine)
    VenueManager.__table__.create(engine)
    return Session(engine)


def add_active_user(session: Session, suffix: str) -> User:
    user = User(
        auth_provider_user_id=f"venue-provider-{suffix}",
        email=f"venue-{suffix}@example.com",
        status=AccountStatus.ACTIVE.value,
    )
    session.add(user)
    session.flush()
    return user


def add_venue(session: Session, suffix: str = "main") -> Venue:
    venue = Venue(
        name=f"Florence Game Cafe {suffix}",
        slug=f"florence-game-cafe-{suffix}",
        venue_type=VenueType.CAFE.value,
        address_line1="100 Game Night Way",
        city="Florence",
        state_region="SC",
        postal_code="29501",
    )
    session.add(venue)
    session.flush()
    return venue


def test_venue_and_manager_round_trip_defaults() -> None:
    with make_session() as session:
        user = add_active_user(session, "round-trip")
        venue = add_venue(session)
        manager = VenueManager(venue_id=venue.id, user_id=user.id)
        session.add(manager)
        session.commit()

        stored_venue = session.scalar(select(Venue).where(Venue.id == venue.id))
        stored_manager = session.scalar(select(VenueManager).where(VenueManager.id == manager.id))
        assert stored_venue is not None
        assert stored_manager is not None
        assert stored_venue.verified is False
        assert stored_venue.active is True
        assert stored_venue.amenities == []
        assert stored_manager.role == VenueManagerRole.MANAGER.value
        assert stored_manager.verified_at is None


def test_venue_slug_is_unique_and_lowercase() -> None:
    with make_session() as session:
        add_venue(session, "unique")
        session.add(
            Venue(
                name="Duplicate Slug",
                slug="florence-game-cafe-unique",
                venue_type=VenueType.RESTAURANT.value,
                address_line1="101 Game Night Way",
                city="Florence",
                state_region="SC",
                postal_code="29501",
            )
        )
        with pytest.raises(IntegrityError):
            session.commit()

    with make_session() as session:
        session.add(
            Venue(
                name="Uppercase Slug",
                slug="Florence-Game-Cafe",
                venue_type=VenueType.CAFE.value,
                address_line1="102 Game Night Way",
                city="Florence",
                state_region="SC",
                postal_code="29501",
            )
        )
        with pytest.raises(IntegrityError):
            session.commit()


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("venue_type", "private_house"),
        ("state_region", "South Carolina"),
        ("state_region", "sc"),
        ("postal_code", "2950"),
        ("latitude", 91.0),
        ("longitude", -181.0),
    ],
)
def test_invalid_public_venue_values_are_rejected(field: str, value: object) -> None:
    with make_session() as session:
        values = {
            "name": "Constraint Venue",
            "slug": "constraint-venue",
            "venue_type": VenueType.PUBLIC_VENUE.value,
            "address_line1": "103 Game Night Way",
            "city": "Florence",
            "state_region": "SC",
            "postal_code": "29501",
        }
        values[field] = value
        session.add(Venue(**values))
        with pytest.raises(IntegrityError):
            session.commit()


def test_one_manager_relationship_per_user_and_venue() -> None:
    with make_session() as session:
        user = add_active_user(session, "relationship")
        venue = add_venue(session, "relationship")
        session.add_all(
            [
                VenueManager(venue_id=venue.id, user_id=user.id),
                VenueManager(
                    venue_id=venue.id,
                    user_id=user.id,
                    role=VenueManagerRole.OWNER.value,
                ),
            ]
        )
        with pytest.raises(IntegrityError):
            session.commit()


def test_real_venue_manager_row_plugs_into_verified_authorization_policy() -> None:
    with make_session() as session:
        user = add_active_user(session, "verified")
        venue = add_venue(session, "verified")
        manager = VenueManager(
            venue_id=venue.id,
            user_id=user.id,
            role=VenueManagerRole.OWNER.value,
        )
        session.add(manager)
        session.flush()

        with pytest.raises(HTTPException) as exc_info:
            require_verified_venue_relationship(user, manager, venue.id)
        assert exc_info.value.status_code == 403

        manager.verified_at = datetime.now(UTC)
        session.flush()
        assert require_verified_venue_relationship(user, manager, venue.id) is user


def test_one_identity_can_be_player_dm_and_verified_venue_manager() -> None:
    with make_session() as session:
        user = add_active_user(session, "multi-role")
        venue = add_venue(session, "multi-role")
        session.add_all(
            [
                UserRole(user_id=user.id, role=UserRoleType.PLAYER.value),
                UserRole(user_id=user.id, role=UserRoleType.GM.value),
                UserRole(user_id=user.id, role=UserRoleType.VENUE_MANAGER.value),
                PlayerProfile(user_id=user.id, postal_code="29501", travel_radius_miles=25),
                GMProfile(
                    user_id=user.id,
                    postal_code="29501",
                    travel_radius_miles=50,
                    gm_style="Narrative and tactical.",
                ),
                VenueManager(
                    venue_id=venue.id,
                    user_id=user.id,
                    role=VenueManagerRole.MANAGER.value,
                    verified_at=datetime.now(UTC),
                ),
            ]
        )
        session.commit()

        assert session.scalar(select(PlayerProfile).where(PlayerProfile.user_id == user.id))
        assert session.scalar(select(GMProfile).where(GMProfile.user_id == user.id))
        manager = session.scalar(select(VenueManager).where(VenueManager.user_id == user.id))
        assert manager is not None
        assert manager.verified_at is not None
