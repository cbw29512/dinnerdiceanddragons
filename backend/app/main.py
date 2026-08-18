"""Dinner, Dice & Dragons production API entrypoint."""

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.health import router as health_router
from app.api.routes.matching_inputs import router as matching_inputs_router
from app.api.routes.me import router as me_router
from app.api.routes.onboarding import router as onboarding_router
from app.api.routes.onboarding_read import router as onboarding_read_router
from app.api.routes.table_match_opportunities import router as table_match_opportunities_router
from app.api.routes.venue_onboarding import router as venue_onboarding_router
from app.api.routes.venue_verification import router as venue_verification_router
from app.core.config import get_settings

LOGGER = logging.getLogger(__name__)


def create_app() -> FastAPI:
    """Build the FastAPI application with explicit browser trust boundaries."""

    try:
        settings = get_settings()
        application = FastAPI(
            title="Dinner, Dice & Dragons API",
            version="0.1.0",
            description=(
                "Production API for matching Players, Dungeon Masters, and "
                "Venues into tabletop games that can actually happen."
            ),
        )

        allowed_origins = settings.cors_origins()
        if allowed_origins:
            application.add_middleware(
                CORSMiddleware,
                allow_origins=allowed_origins,
                allow_credentials=False,
                allow_methods=["GET", "POST", "PUT", "OPTIONS"],
                allow_headers=["Accept", "Authorization", "Content-Type"],
            )

        application.include_router(health_router, prefix="/api/v1")
        application.include_router(me_router, prefix="/api/v1")
        application.include_router(onboarding_router, prefix="/api/v1")
        application.include_router(onboarding_read_router, prefix="/api/v1")
        application.include_router(venue_onboarding_router, prefix="/api/v1")
        application.include_router(venue_verification_router, prefix="/api/v1")
        application.include_router(matching_inputs_router, prefix="/api/v1")
        application.include_router(table_match_opportunities_router, prefix="/api/v1")
        return application
    except Exception:
        LOGGER.exception("Failed to construct FastAPI application")
        raise


app = create_app()
