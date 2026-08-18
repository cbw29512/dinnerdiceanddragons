"""Health, readiness, and safe build-metadata routes for the production API."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.db.session import get_db_session
from app.services.readiness import ReadinessCheckError, check_database_readiness

SERVICE_NAME = "dinner-dice-and-dragons-api"
router = APIRouter(tags=["health"])


@router.get("/health", summary="API health check")
def health_check() -> dict[str, str]:
    """Return a dependency-free liveness response."""

    return {"status": "ok", "service": SERVICE_NAME}


@router.get("/ready", summary="Critical dependency readiness check")
def readiness_check(
    session: Annotated[Session, Depends(get_db_session)],
) -> dict[str, str | dict[str, str]]:
    """Return ready only when the critical PostgreSQL dependency is usable."""

    try:
        check_database_readiness(session)
    except ReadinessCheckError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Service is not ready.",
        ) from exc

    return {
        "status": "ready",
        "service": SERVICE_NAME,
        "dependencies": {"database": "ok"},
    }


@router.get("/version", summary="Safe API build metadata")
def version_info(
    settings: Annotated[Settings, Depends(get_settings)],
) -> dict[str, str]:
    """Expose only non-secret release metadata for operations and support."""

    return {
        "service": SERVICE_NAME,
        "version": settings.app_version,
        "build_sha": settings.build_sha,
        "environment": settings.app_env,
    }
