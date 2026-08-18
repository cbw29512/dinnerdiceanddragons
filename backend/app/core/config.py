"""Typed runtime configuration for the production API."""

from functools import lru_cache
from ipaddress import ip_address
from typing import Literal, Self
from urllib.parse import urlsplit

from pydantic import AnyHttpUrl, Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

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

        errors = [
            *self._production_database_errors(),
            *self._production_supabase_errors(),
            *self._production_cors_errors(),
        ]
        if not self.supabase_jwt_audience.strip():
            errors.append("SUPABASE_JWT_AUDIENCE must not be blank")
        if self.geocodio_api_key is None or not self.geocodio_api_key.get_secret_value().strip():
            errors.append("GEOCODIO_API_KEY is required")
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

    def _production_database_errors(self) -> list[str]:
        raw_url = self.database_url.get_secret_value().strip()
        parsed = urlsplit(raw_url)
        errors: list[str] = []
        if parsed.scheme != "postgresql+psycopg":
            errors.append("DATABASE_URL must use postgresql+psycopg")
        if not parsed.hostname or _is_local_host(parsed.hostname):
            errors.append("DATABASE_URL must use a non-loopback database host")
        if not parsed.username or parsed.password is None:
            errors.append("DATABASE_URL must include managed database credentials")
        elif parsed.username == "ddd" and parsed.password == "ddd":
            errors.append("DATABASE_URL must not use local ddd:ddd credentials")
        return errors

    def _production_supabase_errors(self) -> list[str]:
        if self.supabase_url is None:
            return ["SUPABASE_URL is required"]
        parsed = urlsplit(str(self.supabase_url))
        if parsed.scheme != "https" or not parsed.hostname or _is_local_host(parsed.hostname):
            return ["SUPABASE_URL must be a non-loopback HTTPS origin"]
        return []

    def _production_cors_errors(self) -> list[str]:
        try:
            origins = self.cors_origins()
        except ValueError as exc:
            return [str(exc)]
        if not origins:
            return ["CORS_ALLOWED_ORIGINS must contain at least one production origin"]

        errors: list[str] = []
        for origin in origins:
            parsed = urlsplit(origin)
            if parsed.scheme != "https" or not parsed.hostname or _is_local_host(parsed.hostname):
                errors.append("CORS_ALLOWED_ORIGINS must contain only non-loopback HTTPS origins")
                break
        return errors


def _is_local_host(hostname: str) -> bool:
    normalized = hostname.strip("[]").lower()
    if normalized == "localhost" or normalized.endswith(".localhost"):
        return True
    try:
        return ip_address(normalized).is_loopback
    except ValueError:
        return False


@lru_cache
def get_settings() -> Settings:
    """Return one cached settings object per process."""

    return Settings()
