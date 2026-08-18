"""Fail-closed production configuration contracts."""

import pytest
from pydantic import ValidationError

from app.core.config import Settings

VALID = {
    "app_env": "production",
    "database_url": "postgresql+psycopg://ddd_app:managed-secret@db.example.com:5432/ddd",
    "supabase_url": "https://project-ref.supabase.co",
    "supabase_jwt_audience": "authenticated",
    "geocodio_api_key": "provider-secret",
    "cors_allowed_origins": "https://app.example.com",
}


def production_settings(**overrides) -> Settings:
    return Settings(_env_file=None, **{**VALID, **overrides})


def test_valid_production_settings_construct_successfully() -> None:
    settings = production_settings(
        app_version="2026.08.18",
        build_sha="abc123def456",
    )

    assert settings.app_env == "production"
    assert settings.cors_origins() == ["https://app.example.com"]
    assert settings.safe_summary()["build_sha"] == "abc123def456"


@pytest.mark.parametrize(
    ("database_url", "message"),
    [
        (
            "postgresql+psycopg://ddd:ddd@localhost:5432/ddd",
            "non-loopback database host",
        ),
        (
            "postgresql+psycopg://ddd_app:secret@127.0.0.1:5432/ddd",
            "non-loopback database host",
        ),
        (
            "postgresql://ddd_app:secret@db.example.com:5432/ddd",
            "postgresql+psycopg",
        ),
        (
            "postgresql+psycopg://db.example.com:5432/ddd",
            "managed database credentials",
        ),
    ],
)
def test_production_rejects_unsafe_database_urls(database_url: str, message: str) -> None:
    with pytest.raises(ValidationError, match=message):
        production_settings(database_url=database_url)


def test_production_allows_private_network_database_endpoint() -> None:
    settings = production_settings(
        database_url="postgresql+psycopg://ddd_app:secret@10.20.30.40:5432/ddd"
    )

    assert settings.app_env == "production"


@pytest.mark.parametrize(
    "supabase_url",
    [
        None,
        "http://project-ref.supabase.co",
        "https://localhost:54321",
        "https://127.0.0.1:54321",
    ],
)
def test_production_rejects_missing_or_local_supabase_url(supabase_url: str | None) -> None:
    with pytest.raises(ValidationError, match="SUPABASE_URL"):
        production_settings(supabase_url=supabase_url)


@pytest.mark.parametrize(
    "cors_allowed_origins",
    [
        "",
        "*",
        "http://app.example.com",
        "https://localhost:3000",
        "https://127.0.0.1:3000",
    ],
)
def test_production_rejects_unsafe_cors_origins(cors_allowed_origins: str) -> None:
    with pytest.raises(ValidationError, match="CORS_ALLOWED_ORIGINS"):
        production_settings(cors_allowed_origins=cors_allowed_origins)


@pytest.mark.parametrize("geocodio_api_key", [None, "", "   "])
def test_production_requires_geocodio_credential(geocodio_api_key: str | None) -> None:
    with pytest.raises(ValidationError, match="GEOCODIO_API_KEY"):
        production_settings(geocodio_api_key=geocodio_api_key)


def test_production_rejects_blank_jwt_audience() -> None:
    with pytest.raises(ValidationError, match="SUPABASE_JWT_AUDIENCE"):
        production_settings(supabase_jwt_audience="   ")


def test_bounded_runtime_settings_reject_out_of_range_values() -> None:
    with pytest.raises(ValidationError):
        production_settings(db_connect_timeout_seconds=0)
    with pytest.raises(ValidationError):
        production_settings(db_statement_timeout_ms=99)
    with pytest.raises(ValidationError):
        production_settings(db_pool_size=21)
    with pytest.raises(ValidationError):
        production_settings(outbound_http_timeout_seconds=31.0)


def test_safe_summary_excludes_credentials_and_database_runtime_details() -> None:
    settings = production_settings(
        database_url="postgresql+psycopg://ddd_app:do-not-log@db.example.com:5432/ddd",
        geocodio_api_key="also-do-not-log",
    )

    summary = settings.safe_summary()
    rendered = repr(summary)

    assert "database_url" not in summary
    assert "geocodio_api_key" not in summary
    assert "do-not-log" not in rendered
    assert "also-do-not-log" not in rendered


def test_local_defaults_remain_available_for_development() -> None:
    settings = Settings(_env_file=None)

    assert settings.app_env == "local"
    assert settings.database_url.get_secret_value().startswith(
        "postgresql+psycopg://ddd:ddd@localhost"
    )
    assert settings.supabase_url is None
    assert settings.geocodio_api_key is None
