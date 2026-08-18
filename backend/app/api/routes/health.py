"""Health and safe build-metadata routes for the production API."""

from typing import Annotated

from fastapi import APIRouter, Depends

from app.core.config import Settings, get_settings

SERVICE_NAME = "dinner-dice-and-dragons-api"
router = APIRouter(tags=["health"])


@router.get("/health", summary="API health check")
def health_check() -> dict[str, str]:
    """Return a dependency-free liveness response."""

    return {"status": "ok", "service": SERVICE_NAME}


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
