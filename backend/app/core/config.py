"""Typed runtime configuration for the production API."""

from functools import lru_cache
from typing import Literal, Self
from urllib.parse import urlsplit

from pydantic import AnyHttpUrl, Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.core.production_config import production_configuration_errors

EnvironmentName = Literal["local", "test", "staging", "production"]
LogLevel = Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]


class Settings(BaseSettings):
    """Application settings with a fail-closed production trust boundary."""

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

    db_connect_timeout_seconds: int = Field(default=5, ge=1, le=60)
    db_statement_timeout_ms: int = Field(default=30_000, ge=100, le=300_000)
    db_lock_timeout_ms: int = Field(default=5_000, ge=100, le=60_000)
    db_idle_transaction_timeout_ms: int = Field(default=15_000, ge=1_000, le=300_000)
    db_pool_size: int = Field(default=5, ge=1, le=20)
    db_max_overflow: int = Field(default=5, ge=0, le=20)
    db_pool_timeout_seconds: int = Field(default=5, ge=1, le=60)
    db_pool_recycle_seconds: int = Field(default=300, ge=30, le=3_600)
    outbound_http_timeout_seconds: float = Field(default=5.0, ge=0.5, le=30.0)

    app_version: str = Field(default="dev", min_length=1, max_length=64)
    build_sha: str = Field(default="unknown", min_length=1, max_length=64)

    @model_validator(mode="after")
    def validate_production_boundary(self) -> Self:
        """Reject local/default/incomplete settings before production startup."""

        if self.app_env != "production":
            return self

        try:
            origins = self.cors_origins()
            cors_errors: list[str] = []
        except ValueError as exc:
            origins = []
            cors_errors = [str(exc)]

        errors = [
            *cors_errors,
            *production_configuration_errors(
                database_url=self.database_url.get_secret_value(),
                supabase_url=str(self.supabase_url) if self.supabase_url else None,
                supabase_jwt_audience=self.supabase_jwt_audience,
                geocodio_api_key=(
                    self.geocodio_api_key.get_secret_value()
                    if self.geocodio_api_key is not None
                    else None
                ),
                cors_origins=origins,
            ),
        ]
        if errors:
            raise ValueError("Unsafe production configuration: " + "; ".join(errors))
        return self

    def cors_origins(self) -> list[str]:
        """Return validated, normalized browser origins from configuration."""

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

    def safe_summary(self) -> dict[str, str | int | None]:
        """Return only configuration values safe to write to logs."""

        return {
            "app_env": self.app_env,
            "log_level": self.log_level,
            "supabase_url": str(self.supabase_url) if self.supabase_url else None,
            "supabase_jwt_audience": self.supabase_jwt_audience,
            "cors_allowed_origin_count": len(self.cors_origins()),
            "app_version": self.app_version,
            "build_sha": self.build_sha,
        }


@lru_cache
def get_settings() -> Settings:
    """Return one cached settings object per process."""

    return Settings()
