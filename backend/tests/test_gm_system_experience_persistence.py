"""Tests for GMSystemExperience and GMSystemFormat persistence."""

from decimal import Decimal
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, event, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import metadata
from app.models.game_system import GameSystem
from app.models.gm_profile import GMProfile
from app.models.gm_system_experience import (
    GMComfortLevel,
    GMGameFormat,
    GMSystemExperience,
    GMSystemFormat,
    PreferredPlayerExperience,
)
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


def seed_profile_and_system(session: Session) -> tuple[GMProfile, GameSystem]:
    user = User(
        auth_provider_user_id=f"subject-{uuid4()}",
        email=f"{uuid4()}@example.test",
        status=AccountStatus.ACTIVE.value,
    )
    session.add(user)
    session.flush()

    profile = GMProfile(
        user_id=user.id,
        postal_code="29501",
        travel_radius_miles=25,
        beginner_friendly=True,
        gm_style="Roleplay-forward with tactical combat.",
    )
    system = GameSystem(
        name="Dungeons & Dragons",
        edition="5e (2024)",
        slug=f"dnd-5e-2024-gm-{uuid4()}",
    )
    session.add_all([profile, system])
    session.commit()
    return profile, system


def test_gm_system_experience_round_trip_with_multiple_formats() -> None:
    with make_session() as session:
        profile, system = seed_profile_and_system(session)
        experience = GMSystemExperience(
            gm_profile_id=profile.id,
            game_system_id=system.id,
            years_playing=Decimal("8.5"),
            years_gming=Decimal("5.0"),
            comfort_level=GMComfortLevel.VERY_COMFORTABLE.value,
            preferred_player_experience=PreferredPlayerExperience.ANY.value,
            experience_notes="Comfortable teaching new Players and running campaigns.",
        )
        session.add(experience)
        session.flush()
        session.add_all(
            [
                GMSystemFormat(
                    gm_system_experience_id=experience.id,
                    format=GMGameFormat.ONE_SHOT.value,
                ),
                GMSystemFormat(
                    gm_system_experience_id=experience.id,
                    format=GMGameFormat.LONG_CAMPAIGN.value,
                ),
            ]
        )
        session.commit()

        stored = session.scalar(
            select(GMSystemExperience).where(GMSystemExperience.id == experience.id)
        )
        formats = set(
            session.scalars(
                select(GMSystemFormat.format).where(
                    GMSystemFormat.gm_system_experience_id == experience.id
                )
            ).all()
        )
        assert stored is not None
        assert stored.years_playing == Decimal("8.5")
        assert stored.years_gming == Decimal("5.0")
        assert stored.comfort_level == "very_comfortable"
        assert stored.preferred_player_experience == "any"
        assert formats == {"one_shot", "long_campaign"}


def test_only_one_experience_row_per_gm_and_system() -> None:
    with make_session() as session:
        profile, system = seed_profile_and_system(session)
        session.add(
            GMSystemExperience(
                gm_profile_id=profile.id,
                game_system_id=system.id,
                years_playing=Decimal("1.0"),
                years_gming=Decimal("0.5"),
                comfort_level=GMComfortLevel.LEARNING.value,
                preferred_player_experience=PreferredPlayerExperience.NEW_PLAYERS.value,
            )
        )
        session.commit()
        session.add(
            GMSystemExperience(
                gm_profile_id=profile.id,
                game_system_id=system.id,
                years_playing=Decimal("2.0"),
                years_gming=Decimal("1.0"),
                comfort_level=GMComfortLevel.COMFORTABLE.value,
                preferred_player_experience=PreferredPlayerExperience.ANY.value,
            )
        )
        with pytest.raises(IntegrityError):
            session.commit()


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("years_playing", Decimal("-0.1")),
        ("years_playing", Decimal("80.1")),
        ("years_gming", Decimal("-0.1")),
        ("years_gming", Decimal("80.1")),
    ],
)
def test_gm_year_fields_must_stay_in_supported_range(field: str, value: Decimal) -> None:
    with make_session() as session:
        profile, system = seed_profile_and_system(session)
        values = {
            "years_playing": Decimal("2.0"),
            "years_gming": Decimal("1.0"),
        }
        values[field] = value
        session.add(
            GMSystemExperience(
                gm_profile_id=profile.id,
                game_system_id=system.id,
                years_playing=values["years_playing"],
                years_gming=values["years_gming"],
                comfort_level=GMComfortLevel.COMFORTABLE.value,
                preferred_player_experience=PreferredPlayerExperience.ANY.value,
            )
        )
        with pytest.raises(IntegrityError):
            session.commit()


@pytest.mark.parametrize(
    ("comfort", "preferred"),
    [
        ("verified_expert", PreferredPlayerExperience.ANY.value),
        (GMComfortLevel.EXPERT.value, "only_elite_players"),
    ],
)
def test_invalid_gm_experience_enums_are_rejected(comfort: str, preferred: str) -> None:
    with make_session() as session:
        profile, system = seed_profile_and_system(session)
        session.add(
            GMSystemExperience(
                gm_profile_id=profile.id,
                game_system_id=system.id,
                years_playing=Decimal("5.0"),
                years_gming=Decimal("3.0"),
                comfort_level=comfort,
                preferred_player_experience=preferred,
            )
        )
        with pytest.raises(IntegrityError):
            session.commit()


def test_formats_are_unique_and_canonical() -> None:
    with make_session() as session:
        profile, system = seed_profile_and_system(session)
        experience = GMSystemExperience(
            gm_profile_id=profile.id,
            game_system_id=system.id,
            years_playing=Decimal("5.0"),
            years_gming=Decimal("3.0"),
            comfort_level=GMComfortLevel.COMFORTABLE.value,
            preferred_player_experience=PreferredPlayerExperience.ANY.value,
        )
        session.add(experience)
        session.flush()
        session.add(
            GMSystemFormat(
                gm_system_experience_id=experience.id,
                format=GMGameFormat.ONE_SHOT.value,
            )
        )
        session.commit()

        session.add(
            GMSystemFormat(
                gm_system_experience_id=experience.id,
                format=GMGameFormat.ONE_SHOT.value,
            )
        )
        with pytest.raises(IntegrityError):
            session.commit()
        session.rollback()

        session.add(
            GMSystemFormat(
                gm_system_experience_id=experience.id,
                format="any_format",
            )
        )
        with pytest.raises(IntegrityError):
            session.commit()


def test_gm_profile_delete_cascades_experience_and_formats_system_delete_is_restricted() -> None:
    with make_session() as session:
        profile, system = seed_profile_and_system(session)
        experience = GMSystemExperience(
            gm_profile_id=profile.id,
            game_system_id=system.id,
            years_playing=Decimal("10.0"),
            years_gming=Decimal("7.0"),
            comfort_level=GMComfortLevel.EXPERT.value,
            preferred_player_experience=PreferredPlayerExperience.SOME_EXPERIENCE.value,
        )
        session.add(experience)
        session.flush()
        format_row = GMSystemFormat(
            gm_system_experience_id=experience.id,
            format=GMGameFormat.SHORT_CAMPAIGN.value,
        )
        session.add(format_row)
        session.commit()
        experience_id = experience.id
        system_id = system.id

        session.delete(system)
        with pytest.raises(IntegrityError):
            session.commit()
        session.rollback()

        profile = session.get(GMProfile, profile.id)
        assert profile is not None
        session.delete(profile)
        session.commit()
        assert session.get(GMSystemExperience, experience_id) is None
        assert (
            session.scalar(
                select(GMSystemFormat).where(
                    GMSystemFormat.gm_system_experience_id == experience_id
                )
            )
            is None
        )
        assert session.get(GameSystem, system_id) is not None
