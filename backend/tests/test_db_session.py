"""Database infrastructure tests that do not require a live PostgreSQL server."""

from pydantic import SecretStr
from sqlalchemy.pool import NullPool

from app.core.config import Settings
from app.db.session import _engine_options, build_engine


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


def test_supabase_transaction_pooler_uses_serverless_safe_options() -> None:
    database_url = (
        "postgresql+psycopg://postgres.project-ref:secret@"
        "aws-0-us-east-1.pooler.supabase.com:6543/postgres"
    )

    options = _engine_options(database_url)
    engine = build_engine(make_settings(database_url))

    try:
        assert options["poolclass"] is NullPool
        assert options["connect_args"] == {"prepare_threshold": None}
        assert isinstance(engine.pool, NullPool)
    finally:
        engine.dispose()


def test_session_pooler_keeps_standard_engine_pooling() -> None:
    database_url = (
        "postgresql+psycopg://postgres.project-ref:secret@"
        "aws-0-us-east-1.pooler.supabase.com:5432/postgres"
    )

    options = _engine_options(database_url)

    assert options == {"pool_pre_ping": True}


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
