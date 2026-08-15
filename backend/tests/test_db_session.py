"""Database infrastructure tests that do not require a live PostgreSQL server."""

from pydantic import SecretStr

from app.core.config import Settings
from app.db.session import build_engine


def make_settings(database_url: str) -> Settings:
    return Settings(
        _env_file=None,
        database_url=SecretStr(database_url),
    )


def test_build_engine_uses_postgresql_psycopg_without_connecting() -> None:
    settings = make_settings("postgresql+psycopg://ddd:top-secret@db.example.test:5432/ddd")

    engine = build_engine(settings)

    assert engine.url.drivername == "postgresql+psycopg"
    assert engine.url.database == "ddd"
    assert engine.url.host == "db.example.test"
    assert engine.url.port == 5432
    assert "top-secret" not in str(engine.url)

    engine.dispose()


def test_session_factory_can_bind_to_lazy_engine() -> None:
    from sqlalchemy.orm import Session, sessionmaker

    settings = make_settings("postgresql+psycopg://ddd:secret@db.example.test:5432/ddd")
    engine = build_engine(settings)
    factory = sessionmaker(
        bind=engine,
        class_=Session,
        autoflush=False,
        expire_on_commit=False,
    )

    session = factory()
    try:
        assert session.bind is engine
        assert session.autoflush is False
        assert session.expire_on_commit is False
    finally:
        session.close()
        engine.dispose()
