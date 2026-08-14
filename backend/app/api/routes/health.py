"""Health/readiness routes for the production API."""

from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health", summary="API health check")
def health_check() -> dict[str, str]:
    """Return a small, dependency-free liveness response.

    Database/auth readiness checks will be added separately so this endpoint
    remains useful even when an external dependency is degraded.
    """

    return {"status": "ok", "service": "dinner-dice-and-dragons-api"}
