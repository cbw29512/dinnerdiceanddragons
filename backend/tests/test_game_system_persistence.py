"""Tests for canonical GameSystem catalog persistence."""

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.game_system import GameSystem


def make_session() -> Session:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    GameSystem.__table__.create(engine)
    return Session(engine)


def test_game_system_round_trip_and_active_default() -> None:
    with make_session() as session:
        system = GameSystem(
            name="Dungeons & Dragons",
            edition="5e (2024)",
            slug="dnd-5e-2024",
            publisher_name="Wizards of the Coast",
        )
        session.add(system)
        session.commit()

        stored = session.scalar(select(GameSystem).where(GameSystem.id == system.id))
        assert stored is not None
        assert stored.name == "Dungeons & Dragons"
        assert stored.edition == "5e (2024)"
        assert stored.slug == "dnd-5e-2024"
        assert stored.active is True


def test_system_without_edition_is_allowed_for_catalog_flexibility() -> None:
    with make_session() as session:
        system = GameSystem(name="Other RPG", slug="other-rpg")
        session.add(system)
        session.commit()

        stored = session.scalar(select(GameSystem).where(GameSystem.id == system.id))
        assert stored is not None
        assert stored.edition is None


def test_slug_is_unique_and_lowercase() -> None:
    with make_session() as session:
        session.add(GameSystem(name="D&D", edition="5e 2014", slug="dnd-5e-2014"))
        session.commit()
        session.add(GameSystem(name="Duplicate", slug="dnd-5e-2014"))
        with pytest.raises(IntegrityError):
            session.commit()

    with make_session() as session:
        session.add(GameSystem(name="Uppercase", slug="DND-5E-2024"))
        with pytest.raises(IntegrityError):
            session.commit()


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("name", ""),
        ("edition", ""),
        ("slug", ""),
        ("publisher_name", ""),
    ],
)
def test_blank_catalog_values_are_rejected(field: str, value: str) -> None:
    with make_session() as session:
        values: dict[str, str | None] = {
            "name": "Dungeons & Dragons",
            "edition": "5e (2024)",
            "slug": "dnd-5e-2024",
            "publisher_name": "Wizards of the Coast",
        }
        values[field] = value
        session.add(GameSystem(**values))
        with pytest.raises(IntegrityError):
            session.commit()
