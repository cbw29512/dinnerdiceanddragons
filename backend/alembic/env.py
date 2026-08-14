"""Alembic migration environment for Dinner, Dice & Dragons."""

from logging.config import fileConfig
import logging

from alembic import context

from app.core.config import get_settings
from app.db.base import Base
from app.db.session import get_engine

LOGGER = logging.getLogger(__name__)
config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name, disable_existing_loggers=False)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Generate SQL without opening a PostgreSQL connection."""

    database_url = get_settings().database_url.get_secret_value()
    context.configure(
        url=database_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations against the configured PostgreSQL database."""

    engine = get_engine()
    try:
        with engine.connect() as connection:
            context.configure(
                connection=connection,
                target_metadata=target_metadata,
                compare_type=True,
            )

            with context.begin_transaction():
                context.run_migrations()
    except Exception:
        LOGGER.exception("Database migration failed")
        raise


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
