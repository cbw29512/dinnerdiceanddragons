"""Typed runtime configuration for the production API."""

from functools import lru_cache
from typing import Literal
from urllib.parse import urlsplit

from pydantic import AnyHttpUrl, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

EnvironmentName = Literal["local", "test", "staging", "production"]
LogLevel = Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]


class Settings(BaseSettings):
    """Application settings loaded from environment variables and optional .env.

    Secrets use ``SecretStr`` so accidental ``repr``/logging output is redacted.
    Cross-origin browser access is opt-in through an explicit comma-separated
    origin allowlist; ownership and authorization remain application policy in
    PostgreSQL/FastAPI rather than browser-supplied identifiers.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_env: EnvironmentName = "local"
    log_level: LogLevel = "INFO"
    database_url: SecretStr = SecretStr("postgresql+psycopg://ddd:ddd@localhost:5432/ddd")
    supabase_url: AnyHttpUrl | None = None
    supabase_jwt_audience: str = "authenticated"
    geocodio_api_key: SecretStr | None = None
    cors_allowed_origins: str = ""

    def cors_origins(self) -> list[str]:
        """Return validated, normalized browser origins from configuration."""

        try:
            origins: list[str] = []
            for raw_origin in self.cors_allowed_origins.split(","):
                candidate = raw_origin.strip().rstrip("/")
                if not candidate:
                    continue
                parsed = urlsplit(candidate)
                if (
                    parsed.scheme not in {"http", "https"}
                    or not parsed.netloc
                    or parsed.path
                    or parsed.query
                    or parsed.fragment
                ):
                    raise ValueError(
                        "CORS_ALLOWED_ORIGINS entries must be complete HTTP(S) origins "
                        "without paths, queries, or fragments."
                    )
                normalized = f"{parsed.scheme}://{parsed.netloc}"
                if normalized not in origins:
                    origins.append(normalized)
            return origins
        except Exception:
            raise

    def safe_summary(self) -> dict[str, str | int | None]:
        """Return only configuration values safe to write to logs."""

        return {
            "app_env": self.app_env,
            "log_level": self.log_level,
            "supabase_url": str(self.supabase_url) if self.supabase_url else None,
            "supabase_jwt_audience": self.supabase_jwt_audience,
            "cors_allowed_origin_count": len(self.cors_origins()),
        }


@lru_cache
def get_settings() -> Settings:
    """Return one cached settings object per process."""

    return Settings()
