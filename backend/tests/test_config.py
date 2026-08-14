"""Configuration tests for the production API."""

from pydantic import SecretStr

from app.core.config import Settings


def test_settings_use_safe_local_defaults() -> None:
    settings = Settings(_env_file=None)

    assert settings.app_env == "local"
    assert settings.log_level == "INFO"
    assert isinstance(settings.database_url, SecretStr)
    assert "ddd:ddd" not in repr(settings.database_url)
    assert settings.supabase_url is None
    assert settings.supabase_jwt_audience == "authenticated"


def test_environment_values_override_defaults(monkeypatch) -> None:
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("LOG_LEVEL", "WARNING")
    monkeypatch.setenv(
        "DATABASE_URL",
        "postgresql+psycopg://user:super-secret@db.example.test:5432/ddd",
    )
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")

    settings = Settings(_env_file=None)

    assert settings.app_env == "test"
    assert settings.log_level == "WARNING"
    assert settings.database_url.get_secret_value().endswith("/ddd")
    assert "super-secret" not in repr(settings.database_url)
    assert str(settings.supabase_url) == "https://example.supabase.co/"


def test_safe_summary_never_contains_database_credentials(monkeypatch) -> None:
    monkeypatch.setenv(
        "DATABASE_URL",
        "postgresql+psycopg://user:do-not-log-me@db.example.test:5432/ddd",
    )

    settings = Settings(_env_file=None)
    summary = settings.safe_summary()

    assert "database_url" not in summary
    assert "do-not-log-me" not in repr(summary)
