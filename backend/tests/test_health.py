"""Smoke tests for production API liveness and safe release metadata."""

from fastapi.testclient import TestClient

from app.core.config import Settings, get_settings
from app.main import app

client = TestClient(app)


def test_health_endpoint_reports_service_alive() -> None:
    response = client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "dinner-dice-and-dragons-api",
    }


def test_version_endpoint_exposes_only_safe_build_metadata() -> None:
    settings = Settings(
        _env_file=None,
        app_env="staging",
        database_url="postgresql+psycopg://user:do-not-expose@db.example.test:5432/ddd",
        geocodio_api_key="do-not-expose-provider-secret",
        app_version="2026.08.18",
        build_sha="abcdef1234567890",
    )
    app.dependency_overrides[get_settings] = lambda: settings
    try:
        response = client.get("/api/v1/version")
    finally:
        app.dependency_overrides.pop(get_settings, None)

    assert response.status_code == 200
    assert response.json() == {
        "service": "dinner-dice-and-dragons-api",
        "version": "2026.08.18",
        "build_sha": "abcdef1234567890",
        "environment": "staging",
    }
    assert "do-not-expose" not in response.text
