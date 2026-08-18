"""Regression tests for production IP rate-limit middleware behavior."""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.security.rate_limit_middleware import RateLimitMiddleware
from app.security.rate_limit_policy import RateLimitDecision


def _app() -> FastAPI:
    application = FastAPI()
    application.add_middleware(
        RateLimitMiddleware,
        settings=Settings(app_env="production", rate_limit_hmac_key="x" * 32),
    )

    @application.get("/api/v1/example")
    def example() -> dict[str, bool]:
        return {"ok": True}

    @application.get("/api/v1/explodes")
    def explodes() -> None:
        raise RuntimeError("route failure")

    return application


def test_denied_ip_request_returns_stable_429(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "app.security.rate_limit_middleware.enforce_subject_rate_limit",
        lambda *args, **kwargs: RateLimitDecision(False, 600, 0, 23),
    )

    response = TestClient(_app()).get(
        "/api/v1/example",
        headers={"x-vercel-forwarded-for": "203.0.113.9"},
    )

    assert response.status_code == 429
    assert response.json() == {"detail": "Too many requests. Try again shortly."}
    assert response.headers["retry-after"] == "23"
    assert response.headers["x-ratelimit-remaining"] == "0"


def test_allowed_ip_request_exposes_remaining_allowance(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "app.security.rate_limit_middleware.enforce_subject_rate_limit",
        lambda *args, **kwargs: RateLimitDecision(True, 600, 599, 60),
    )

    response = TestClient(_app()).get(
        "/api/v1/example",
        headers={"x-vercel-forwarded-for": "203.0.113.9"},
    )

    assert response.status_code == 200
    assert response.headers["x-ratelimit-limit"] == "600"
    assert response.headers["x-ratelimit-remaining"] == "599"


def test_route_failure_is_not_rewritten_as_rate_limit_503(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "app.security.rate_limit_middleware.enforce_subject_rate_limit",
        lambda *args, **kwargs: RateLimitDecision(True, 600, 599, 60),
    )

    with pytest.raises(RuntimeError, match="route failure"):
        TestClient(_app()).get(
            "/api/v1/explodes",
            headers={"x-vercel-forwarded-for": "203.0.113.9"},
        )
