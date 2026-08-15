"""Tests for durable PlayerProfile persistence invariants."""

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.player_profile import PlayerProfile, PreferredGameFormat
from app.models.user import AccountStatus, User


def make_session() -> Session:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    User.__table__.create(engine)
    PlayerProfile.__table__.create(engine)
    return Session(engine)


def add_active_user(session: Session, suffix: str) -> User:
    user = User(
        auth_provider_user_id=f"player-provider-{suffix}",
        email=f"player-{suffix}@example.com",
        status=AccountStatus.ACTIVE.value,
    )
    session.add(user)
    session.flush()
    return user


def test_player_profile_round_trips_private_matching_fields_and_defaults() -> None:
    with make_session() as session:
        user = add_active_user(session, "round-trip")
        profile = PlayerProfile(
            user_id=user.id,
            bio="Looking for a friendly local table.",
            postal_code="29501",
            travel_radius_miles=25,
            environment_preferences=["quieter_venue", "well_lit"],
            accessibility_notes_private="Needs a chair with back support.",
        )
        session.add(profile)
        session.commit()

        stored = session.scalar(select(PlayerProfile).where(PlayerProfile.user_id == user.id))
        assert stored is not None
        assert stored.id is not None
        assert stored.preferred_format == PreferredGameFormat.ANY.value
        assert stored.willing_to_learn_new_system is True
        assert stored.environment_preferences == ["quieter_venue", "well_lit"]
        assert stored.postal_code == "29501"
        assert stored.travel_radius_miles == 25
        assert stored.accessibility_notes_private == "Needs a chair with back support."


def test_one_player_profile_per_user_is_enforced() -> None:
    with make_session() as session:
        user = add_active_user(session, "unique")
        session.add_all(
            [
                PlayerProfile(user_id=user.id, postal_code="29501", travel_radius_miles=25),
                PlayerProfile(user_id=user.id, postal_code="29501", travel_radius_miles=10),
            ]
        )
        with pytest.raises(IntegrityError):
            session.commit()


@pytest.mark.parametrize("radius", [0, 101])
def test_travel_radius_outside_supported_range_is_rejected(radius: int) -> None:
    with make_session() as session:
        user = add_active_user(session, f"radius-{radius}")
        session.add(
            PlayerProfile(user_id=user.id, postal_code="29501", travel_radius_miles=radius)
        )
        with pytest.raises(IntegrityError):
            session.commit()


def test_non_five_character_postal_code_is_rejected() -> None:
    with make_session() as session:
        user = add_active_user(session, "postal")
        session.add(PlayerProfile(user_id=user.id, postal_code="2950", travel_radius_miles=25))
        with pytest.raises(IntegrityError):
            session.commit()


def test_unknown_preferred_format_is_rejected() -> None:
    with make_session() as session:
        user = add_active_user(session, "format")
        session.add(
            PlayerProfile(
                user_id=user.id,
                postal_code="29501",
                travel_radius_miles=25,
                preferred_format="forever_campaign_plus",
            )
        )
        with pytest.raises(IntegrityError):
            session.commit()
