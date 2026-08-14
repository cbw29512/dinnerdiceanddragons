"""Dinner, Dice & Dragons production API entrypoint."""

import logging

from fastapi import FastAPI

from app.api.routes.health import router as health_router

LOGGER = logging.getLogger(__name__)


def create_app() -> FastAPI:
    """Build the FastAPI application.

    Keeping app construction in a factory makes tests deterministic and gives
    us a clean place to add settings, middleware, auth, and lifecycle hooks as
    the production backend grows.
    """

    try:
        application = FastAPI(
            title="Dinner, Dice & Dragons API",
            version="0.1.0",
            description=(
                "Production API for matching Players, Dungeon Masters, and "
                "Venues into tabletop games that can actually happen."
            ),
        )
        application.include_router(health_router, prefix="/api/v1")
        return application
    except Exception:
        LOGGER.exception("Failed to construct FastAPI application")
        raise


app = create_app()
