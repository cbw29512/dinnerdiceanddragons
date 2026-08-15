"""Regression tests for the anonymous browse-only API policy."""

from fastapi.routing import APIRoute
from fastapi.testclient import TestClient

from app.api.dependencies.auth import (
    get_supabase_jwt_verifier,
    get_verified_supabase_claims,
)
from app.main import create_app

MUTATING_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


def _dependency_calls(route: APIRoute) -> set[object]:
    """Collect dependency callables recursively for one FastAPI route."""

    calls: set[object] = set()
    pending = list(route.dependant.dependencies)
    while pending:
        dependency = pending.pop()
        if dependency.call is not None:
            calls.add(dependency.call)
        pending.extend(dependency.dependencies)
    return calls


def test_every_mutating_production_api_route_requires_verified_authentication() -> None:
    application = create_app()

    for route in application.routes:
        if not isinstance(route, APIRoute) or not route.path.startswith("/api/v1"):
            continue
        mutating = set(route.methods or set()) & MUTATING_METHODS
        if not mutating:
            continue

        assert get_verified_supabase_claims in _dependency_calls(route), (
            f"{sorted(mutating)} {route.path} would allow a production mutation "
            "without the verified Supabase authentication dependency."
        )


def test_anonymous_request_can_reach_public_health_but_not_private_identity() -> None:
    application = create_app()
    application.dependency_overrides[get_supabase_jwt_verifier] = lambda: None
    client = TestClient(application)

    health = client.get("/api/v1/health")
    identity = client.get("/api/v1/me")

    assert health.status_code == 200
    assert identity.status_code == 401
    assert identity.headers["www-authenticate"] == "Bearer"
    assert identity.json() == {"detail": "Authentication required."}


def test_bearer_request_reports_unconfigured_auth_service_after_credentials_check() -> None:
    application = create_app()
    application.dependency_overrides[get_supabase_jwt_verifier] = lambda: None
    client = TestClient(application)

    response = client.get(
        "/api/v1/me",
        headers={"Authorization": "Bearer supplied-but-unverifiable"},
    )

    assert response.status_code == 503
    assert response.json() == {"detail": "Authentication service is not configured."}
