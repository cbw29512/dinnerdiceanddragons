"""SQLAlchemy engine/session lifecycle for PostgreSQL."""

import logging
from collections.abc import Generator
from functools import lru_cache
from typing import Any

from sqlalchemy import Engine, create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import NullPool

from app.core.config import Settings, get_settings

LOGGER = logging.getLogger(__name__)


def _engine_options(database_url: str) -> dict[str, Any]:
    """Return safe pool settings for the configured PostgreSQL endpoint."""

    url = make_url(database_url)
    host = url.host or ""
    if host.endswith(".pooler.supabase.com") and url.port == 6543:
        return {
            "poolclass": NullPool,
            "connect_args": {"prepare_threshold": None},
        }
    return {"pool_pre_ping": True}


def build_engine(settings: Settings) -> Engine:
    """Create a lazy SQLAlchemy engine without opening a DB connection yet."""

    try:
        database_url = settings.database_url.get_secret_value()
        return create_engine(
            database_url,
            hide_parameters=True,
            **_engine_options(database_url),
        )
    except Exception:
        LOGGER.exception("Failed to construct database engine")
        raise


@lru_cache
def get_engine() -> Engine:
    """Return one process-wide engine configured from application settings."""

    return build_engine(get_settings())


@lru_cache
def get_session_factory() -> sessionmaker[Session]:
    """Return the process-wide SQLAlchemy Session factory."""

    return sessionmaker(
        bind=get_engine(),
        class_=Session,
        autoflush=False,
        expire_on_commit=False,
    )


def get_db_session() -> Generator[Session]:
    """FastAPI dependency that safely scopes one database session per request."""

    session = get_session_factory()()
    try:
        yield session
    except Exception:
        try:
            session.rollback()
        except Exception:
            LOGGER.exception("Database rollback failed after request error")
        raise
    finally:
        session.close()
