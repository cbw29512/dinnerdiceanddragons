"""FastAPI construction contracts for fail-closed production configuration."""

import pytest
from pydantic import ValidationError

from app.core.config import get_settings
from app.main import create_app


def _set_valid_production_env(monkeypatch) -> None:
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv(
        "DATABASE_URL",
        "postgresql+psycopg://ddd_app:managed-secret@db.example.com:5432/ddd",
    )
    monkeypatch.setenv("SUPABASE_URL", "https://project-ref.supabase.co")
    monkeypatch.setenv("SUPABASE_JWT_AUDIENCE", "authenticated")
    monkeypatch.setenv("GEOCODIO_API_KEY", "provider-secret")
    monkeypatch.setenv("CORS_ALLOWED_ORIGINS", "https://app.example.com")


def test_fastapi_construction_rejects_local_database_in_production(monkeypatch) -> None:
    _set_valid_production_env(monkeypatch)
    monkeypatch.setenv("DATABASE_URL", "postgresql+psycopg://ddd:ddd@localhost:5432/ddd")
    get_settings.cache_clear()
    try:
        with pytest.raises(ValidationError, match="non-loopback database host"):
            create_app()
    finally:
        get_settings.cache_clear()


def test_fastapi_construction_accepts_complete_production_environment(monkeypatch) -> None:
    _set_valid_production_env(monkeypatch)
    get_settings.cache_clear()
    try:
        application = create_app()
        assert application.title == "Dinner, Dice & Dragons API"
    finally:
        get_settings.cache_clear()
