"""Critical dependency readiness checks for the production API."""

import logging

from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

LOGGER = logging.getLogger(__name__)


class ReadinessCheckError(RuntimeError):
    """Raised when a critical dependency cannot safely serve API traffic."""


def check_database_readiness(session: Session) -> None:
    """Verify the critical PostgreSQL dependency through the application Session."""

    try:
        value = session.scalar(text("SELECT 1"))
        if value != 1:
            raise ReadinessCheckError("Database readiness query returned an unexpected result.")
    except ReadinessCheckError:
        raise
    except SQLAlchemyError as exc:
        LOGGER.warning(
            "Database readiness check failed",
            extra={"error_type": type(exc).__name__},
        )
        raise ReadinessCheckError("Database dependency is not ready.") from exc


__all__ = ["ReadinessCheckError", "check_database_readiness"]
