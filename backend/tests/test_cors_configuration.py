"""Production browser-origin trust-boundary tests."""

import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings, get_settings
from app.main import create_app


def test_cors_origins_are_normalized_and_deduplicated() -> None:
    settings = Settings(
        cors_allowed_origins=(
            "https://cbw29512.github.io/, http://localhost:8080, https://cbw29512.github.io"
        )
    )

    assert settings.cors_origins() == [
        "https://cbw29512.github.io",
        "http://localhost:8080",
    ]


def test_cors_origin_rejects_paths_queries_and_fragments() -> None:
    invalid_values = (
        "https://cbw29512.github.io/dinnerdiceanddragons",
        "https://cbw29512.github.io?preview=1",
        "https://cbw29512.github.io#section",
        "ftp://cbw29512.github.io",
    )

    for value in invalid_values:
        with pytest.raises(ValueError, match=r"complete HTTP\(S\) origins"):
            Settings(cors_allowed_origins=value).cors_origins()


def test_allowed_github_pages_origin_can_preflight_bearer_put(monkeypatch) -> None:
    monkeypatch.setenv("CORS_ALLOWED_ORIGINS", "https://cbw29512.github.io")
    get_settings.cache_clear()
    try:
        with TestClient(create_app()) as client:
            response = client.options(
                "/api/v1/onboarding/player",
                headers={
                    "Origin": "https://cbw29512.github.io",
                    "Access-Control-Request-Method": "PUT",
                    "Access-Control-Request-Headers": "authorization,content-type",
                },
            )
            assert response.status_code == 200
            assert response.headers["access-control-allow-origin"] == (
                "https://cbw29512.github.io"
            )
            assert "authorization" in response.headers[
                "access-control-allow-headers"
            ].lower()
    finally:
        get_settings.cache_clear()


def test_unlisted_origin_is_rejected_by_preflight(monkeypatch) -> None:
    monkeypatch.setenv("CORS_ALLOWED_ORIGINS", "https://cbw29512.github.io")
    get_settings.cache_clear()
    try:
        with TestClient(create_app()) as client:
            response = client.options(
                "/api/v1/onboarding/player",
                headers={
                    "Origin": "https://example.invalid",
                    "Access-Control-Request-Method": "PUT",
                    "Access-Control-Request-Headers": "authorization,content-type",
                },
            )
            assert response.status_code == 400
            assert "access-control-allow-origin" not in response.headers
    finally:
        get_settings.cache_clear()
