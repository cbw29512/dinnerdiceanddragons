"""SQLAlchemy engine/session lifecycle for PostgreSQL."""

import logging
from collections.abc import Generator
from functools import lru_cache

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import Settings, get_settings

LOGGER = logging.getLogger(__name__)


def build_engine(settings: Settings) -> Engine:
    """Create a lazy SQLAlchemy engine without opening a DB connection yet."""

    try:
        return create_engine(
            settings.database_url.get_secret_value(),
            pool_pre_ping=True,
            hide_parameters=True,
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
