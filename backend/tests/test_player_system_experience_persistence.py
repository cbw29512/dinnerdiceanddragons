"""Tests for PlayerSystemExperience persistence and integrity."""

from decimal import Decimal
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, event, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import metadata
from app.models.game_system import GameSystem
from app.models.player_profile import PlayerProfile
from app.models.player_system_experience import PlayerComfortLevel, PlayerSystemExperience
from app.models.user import AccountStatus, User


def make_session() -> Session:
    engine = create_engine("sqlite+pysqlite:///:memory:")

    @event.listens_for(engine, "connect")
    def enable_foreign_keys(dbapi_connection: object, _connection_record: object) -> None:
        cursor = dbapi_connection.cursor()  # type: ignore[attr-defined]
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    metadata.create_all(engine)
    return Session(engine)


def seed_profile_and_system(session: Session) -> tuple[PlayerProfile, GameSystem]:
    user = User(
        auth_provider_user_id=f"subject-{uuid4()}",
        email=f"{uuid4()}@example.test",
        status=AccountStatus.ACTIVE.value,
    )
    session.add(user)
    session.flush()

    profile = PlayerProfile(
        user_id=user.id,
        postal_code="29501",
        travel_radius_miles=25,
    )
    system = GameSystem(
        name="Dungeons & Dragons",
        edition="5e (2024)",
        slug=f"dnd-5e-2024-{uuid4()}",
    )
    session.add_all([profile, system])
    session.commit()
    return profile, system


def test_player_system_experience_round_trip() -> None:
    with make_session() as session:
        profile, system = seed_profile_and_system(session)
        experience = PlayerSystemExperience(
            player_profile_id=profile.id,
            game_system_id=system.id,
            years_playing=Decimal("2.5"),
            comfort_level=PlayerComfortLevel.COMFORTABLE.value,
            experience_notes="Comfortable with one-shots and campaigns.",
        )
        session.add(experience)
        session.commit()

        stored = session.scalar(
            select(PlayerSystemExperience).where(PlayerSystemExperience.id == experience.id)
        )
        assert stored is not None
        assert stored.years_playing == Decimal("2.5")
        assert stored.comfort_level == "comfortable"
        assert stored.experience_notes == "Comfortable with one-shots and campaigns."


def test_only_one_experience_row_per_player_and_system() -> None:
    with make_session() as session:
        profile, system = seed_profile_and_system(session)
        session.add(
            PlayerSystemExperience(
                player_profile_id=profile.id,
                game_system_id=system.id,
                years_playing=Decimal("1.0"),
                comfort_level=PlayerComfortLevel.LEARNING.value,
            )
        )
        session.commit()
        session.add(
            PlayerSystemExperience(
                player_profile_id=profile.id,
                game_system_id=system.id,
                years_playing=Decimal("3.0"),
                comfort_level=PlayerComfortLevel.COMFORTABLE.value,
            )
        )
        with pytest.raises(IntegrityError):
            session.commit()


@pytest.mark.parametrize("years", [Decimal("-0.1"), Decimal("80.1")])
def test_years_playing_must_stay_in_supported_range(years: Decimal) -> None:
    with make_session() as session:
        profile, system = seed_profile_and_system(session)
        session.add(
            PlayerSystemExperience(
                player_profile_id=profile.id,
                game_system_id=system.id,
                years_playing=years,
                comfort_level=PlayerComfortLevel.NEW.value,
            )
        )
        with pytest.raises(IntegrityError):
            session.commit()


def test_invalid_comfort_level_is_rejected() -> None:
    with make_session() as session:
        profile, system = seed_profile_and_system(session)
        session.add(
            PlayerSystemExperience(
                player_profile_id=profile.id,
                game_system_id=system.id,
                years_playing=Decimal("0.0"),
                comfort_level="expert_verified",
            )
        )
        with pytest.raises(IntegrityError):
            session.commit()


def test_blank_experience_notes_are_rejected_when_present() -> None:
    with make_session() as session:
        profile, system = seed_profile_and_system(session)
        session.add(
            PlayerSystemExperience(
                player_profile_id=profile.id,
                game_system_id=system.id,
                years_playing=Decimal("0.5"),
                comfort_level=PlayerComfortLevel.NEW.value,
                experience_notes="   ",
            )
        )
        with pytest.raises(IntegrityError):
            session.commit()


def test_profile_delete_cascades_experience_but_system_delete_is_restricted() -> None:
    with make_session() as session:
        profile, system = seed_profile_and_system(session)
        experience = PlayerSystemExperience(
            player_profile_id=profile.id,
            game_system_id=system.id,
            years_playing=Decimal("4.0"),
            comfort_level=PlayerComfortLevel.VERY_EXPERIENCED.value,
        )
        session.add(experience)
        session.commit()
        experience_id = experience.id
        system_id = system.id

        session.delete(system)
        with pytest.raises(IntegrityError):
            session.commit()
        session.rollback()

        profile = session.get(PlayerProfile, profile.id)
        assert profile is not None
        session.delete(profile)
        session.commit()
        assert session.get(PlayerSystemExperience, experience_id) is None
        assert session.get(GameSystem, system_id) is not None
