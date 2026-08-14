"""Typed runtime configuration for the production API."""

from functools import lru_cache
from typing import Literal

from pydantic import AnyHttpUrl, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

EnvironmentName = Literal["local", "test", "staging", "production"]
LogLevel = Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]


class Settings(BaseSettings):
    """Application settings loaded from environment variables and optional .env.

    Secrets use ``SecretStr`` so accidental ``repr``/logging output is redacted.
    Provider-specific values are intentionally minimal until the auth step is
    implemented; authorization will remain application policy in PostgreSQL.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_env: EnvironmentName = "local"
    log_level: LogLevel = "INFO"
    database_url: SecretStr = SecretStr(
        "postgresql+psycopg://ddd:ddd@localhost:5432/ddd"
    )
    supabase_url: AnyHttpUrl | None = None
    supabase_jwt_audience: str = "authenticated"

    def safe_summary(self) -> dict[str, str | None]:
        """Return only configuration values safe to write to logs."""

        return {
            "app_env": self.app_env,
            "log_level": self.log_level,
            "supabase_url": str(self.supabase_url) if self.supabase_url else None,
            "supabase_jwt_audience": self.supabase_jwt_audience,
        }


@lru_cache
def get_settings() -> Settings:
    """Return one cached settings object per process."""

    return Settings()
