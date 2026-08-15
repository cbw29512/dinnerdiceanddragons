"""Tests for durable GMProfile persistence invariants."""

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.gm_profile import GMProfile
from app.models.player_profile import PlayerProfile
from app.models.user import AccountStatus, User


def make_session() -> Session:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    User.__table__.create(engine)
    PlayerProfile.__table__.create(engine)
    GMProfile.__table__.create(engine)
    return Session(engine)


def add_active_user(session: Session, suffix: str) -> User:
    user = User(
        auth_provider_user_id=f"gm-provider-{suffix}",
        email=f"gm-{suffix}@example.com",
        status=AccountStatus.ACTIVE.value,
    )
    session.add(user)
    session.flush()
    return user


def test_gm_profile_round_trips_durable_matching_fields_and_defaults() -> None:
    with make_session() as session:
        user = add_active_user(session, "round-trip")
        profile = GMProfile(
            user_id=user.id,
            bio="Longtime local DM.",
            postal_code="29501",
            travel_radius_miles=25,
            gm_style="Roleplay-forward with tactical combat and clear table expectations.",
        )
        session.add(profile)
        session.commit()

        stored = session.scalar(select(GMProfile).where(GMProfile.user_id == user.id))
        assert stored is not None
        assert stored.id is not None
        assert stored.bio == "Longtime local DM."
        assert stored.postal_code == "29501"
        assert stored.travel_radius_miles == 25
        assert stored.beginner_friendly is False
        assert stored.gm_style.startswith("Roleplay-forward")


def test_one_gm_profile_per_user_is_enforced() -> None:
    with make_session() as session:
        user = add_active_user(session, "unique")
        session.add_all(
            [
                GMProfile(
                    user_id=user.id,
                    postal_code="29501",
                    travel_radius_miles=25,
                    gm_style="Story-forward.",
                ),
                GMProfile(
                    user_id=user.id,
                    postal_code="29501",
                    travel_radius_miles=10,
                    gm_style="Tactical.",
                ),
            ]
        )
        with pytest.raises(IntegrityError):
            session.commit()


@pytest.mark.parametrize("radius", [0, 101])
def test_gm_travel_radius_outside_supported_range_is_rejected(radius: int) -> None:
    with make_session() as session:
        user = add_active_user(session, f"radius-{radius}")
        session.add(
            GMProfile(
                user_id=user.id,
                postal_code="29501",
                travel_radius_miles=radius,
                gm_style="Balanced table.",
            )
        )
        with pytest.raises(IntegrityError):
            session.commit()


def test_gm_postal_code_must_be_five_characters() -> None:
    with make_session() as session:
        user = add_active_user(session, "postal")
        session.add(
            GMProfile(
                user_id=user.id,
                postal_code="2950",
                travel_radius_miles=25,
                gm_style="Balanced table.",
            )
        )
        with pytest.raises(IntegrityError):
            session.commit()


@pytest.mark.parametrize("gm_style", ["", "   "])
def test_gm_style_cannot_be_empty_or_whitespace(gm_style: str) -> None:
    with make_session() as session:
        user = add_active_user(session, f"style-{len(gm_style)}")
        session.add(
            GMProfile(
                user_id=user.id,
                postal_code="29501",
                travel_radius_miles=25,
                gm_style=gm_style,
            )
        )
        with pytest.raises(IntegrityError):
            session.commit()


def test_same_user_can_hold_player_and_gm_profiles() -> None:
    with make_session() as session:
        user = add_active_user(session, "multi-profile")
        player_profile = PlayerProfile(
            user_id=user.id,
            postal_code="29501",
            travel_radius_miles=25,
        )
        gm_profile = GMProfile(
            user_id=user.id,
            postal_code="29501",
            travel_radius_miles=50,
            beginner_friendly=True,
            gm_style="Welcoming to beginners with a narrative focus.",
        )
        session.add_all([player_profile, gm_profile])
        session.commit()

        assert (
            session.scalar(select(PlayerProfile).where(PlayerProfile.user_id == user.id))
            is not None
        )
        stored_gm = session.scalar(select(GMProfile).where(GMProfile.user_id == user.id))
        assert stored_gm is not None
        assert stored_gm.beginner_friendly is True
