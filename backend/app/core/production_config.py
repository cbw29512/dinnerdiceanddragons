"""Fail-closed validation helpers for production-only configuration."""

from ipaddress import ip_address
from urllib.parse import urlsplit


def production_configuration_errors(
    *,
    database_url: str,
    supabase_url: str | None,
    supabase_jwt_audience: str,
    geocodio_api_key: str | None,
    cors_origins: list[str],
) -> list[str]:
    """Return safe, secret-free descriptions of invalid production settings."""

    return [
        *_database_errors(database_url),
        *_supabase_errors(supabase_url),
        *_cors_errors(cors_origins),
        *([] if supabase_jwt_audience.strip() else ["SUPABASE_JWT_AUDIENCE must not be blank"]),
        *([] if geocodio_api_key and geocodio_api_key.strip() else ["GEOCODIO_API_KEY is required"]),
    ]


def _database_errors(database_url: str) -> list[str]:
    parsed = urlsplit(database_url.strip())
    errors: list[str] = []
    if parsed.scheme != "postgresql+psycopg":
        errors.append("DATABASE_URL must use postgresql+psycopg")
    if not parsed.hostname or _is_loopback_host(parsed.hostname):
        errors.append("DATABASE_URL must use a non-loopback database host")
    if not parsed.username or parsed.password is None:
        errors.append("DATABASE_URL must include managed database credentials")
    elif parsed.username == "ddd" and parsed.password == "ddd":
        errors.append("DATABASE_URL must not use local ddd:ddd credentials")
    return errors


def _supabase_errors(supabase_url: str | None) -> list[str]:
    if not supabase_url:
        return ["SUPABASE_URL is required"]
    parsed = urlsplit(supabase_url)
    if parsed.scheme != "https" or not parsed.hostname or _is_loopback_host(parsed.hostname):
        return ["SUPABASE_URL must be a non-loopback HTTPS origin"]
    return []


def _cors_errors(origins: list[str]) -> list[str]:
    if not origins:
        return ["CORS_ALLOWED_ORIGINS must contain at least one production origin"]
    for origin in origins:
        parsed = urlsplit(origin)
        if parsed.scheme != "https" or not parsed.hostname or _is_loopback_host(parsed.hostname):
            return ["CORS_ALLOWED_ORIGINS must contain only non-loopback HTTPS origins"]
    return []


def _is_loopback_host(hostname: str) -> bool:
    normalized = hostname.strip("[]").lower()
    if normalized == "localhost" or normalized.endswith((".localhost", ".local")):
        return True
    try:
        return ip_address(normalized).is_loopback
    except ValueError:
        return False


__all__ = ["production_configuration_errors"]
