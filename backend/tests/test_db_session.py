"""Database infrastructure tests that do not require a live PostgreSQL server."""

from pydantic import SecretStr
from sqlalchemy.pool import NullPool

from app.core.config import Settings
from app.db.session import _engine_options, _transaction_timeout_sql, build_engine


def make_settings(database_url: str) -> Settings:
    return Settings(
        _env_file=None,
        database_url=SecretStr(database_url),
        db_connect_timeout_seconds=7,
        db_statement_timeout_ms=22_000,
        db_lock_timeout_ms=4_000,
        db_idle_transaction_timeout_ms=12_000,
        db_pool_size=4,
        db_max_overflow=3,
        db_pool_timeout_seconds=6,
        db_pool_recycle_seconds=240,
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
    settings = make_settings(database_url)

    options = _engine_options(database_url, settings)
    engine = build_engine(settings)

    try:
        assert options["poolclass"] is NullPool
        assert options["connect_args"] == {
            "connect_timeout": 7,
            "prepare_threshold": None,
        }
        assert isinstance(engine.pool, NullPool)
    finally:
        engine.dispose()


def test_non_transaction_pooler_uses_bounded_engine_pooling() -> None:
    database_url = (
        "postgresql+psycopg://postgres.project-ref:secret@"
        "aws-0-us-east-1.pooler.supabase.com:5432/postgres"
    )
    settings = make_settings(database_url)

    options = _engine_options(database_url, settings)

    assert options == {
        "pool_pre_ping": True,
        "pool_size": 4,
        "max_overflow": 3,
        "pool_timeout": 6,
        "pool_recycle": 240,
        "connect_args": {"connect_timeout": 7},
    }


def test_transaction_limits_are_applied_with_set_local_semantics() -> None:
    settings = make_settings("postgresql+psycopg://ddd:secret@db.example.test:5432/ddd")

    sql = _transaction_timeout_sql(settings)

    assert "set_config('statement_timeout', '22000', true)" in sql
    assert "set_config('lock_timeout', '4000', true)" in sql
    assert "set_config('idle_in_transaction_session_timeout', '12000', true)" in sql


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
