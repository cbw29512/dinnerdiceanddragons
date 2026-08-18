"""Unit tests for rate-limit classification, subject trust, and privacy."""

import pytest
from fastapi import Request

from app.core.config import Settings
from app.security.rate_limit_policy import (
    EXPENSIVE_POLICY,
    MESSAGE_POLICY,
    MUTATION_POLICY,
    READ_POLICY,
    hash_rate_limit_subject,
    policy_for_request,
    resolve_client_ip,
)


def _request(*, forwarded_for: str | None = None, client_ip: str = "127.0.0.1") -> Request:
    """Build the minimum ASGI request scope needed by client-IP resolution."""

    headers: list[tuple[bytes, bytes]] = []
    if forwarded_for is not None:
        headers.append((b"x-vercel-forwarded-for", forwarded_for.encode("ascii")))
    return Request(
        {
            "type": "http",
            "http_version": "1.1",
            "method": "GET",
            "scheme": "https",
            "path": "/api/v1/me",
            "raw_path": b"/api/v1/me",
            "query_string": b"",
            "headers": headers,
            "client": (client_ip, 44321),
            "server": ("testserver", 443),
        }
    )


def test_endpoint_classes_have_distinct_bounded_policies() -> None:
    assert policy_for_request("GET", "/api/v1/me") == READ_POLICY
    assert policy_for_request("POST", "/api/v1/onboarding/player") == MUTATION_POLICY
    assert policy_for_request("POST", "/api/v1/events/abc/messages") == MESSAGE_POLICY
    assert policy_for_request("POST", "/api/v1/matching/run") == EXPENSIVE_POLICY
    assert policy_for_request("OPTIONS", "/api/v1/onboarding/player") is None
    assert policy_for_request("GET", "/api/v1/health") is None


def test_shared_ip_allowance_is_not_the_authenticated_user_allowance() -> None:
    assert MUTATION_POLICY.limit_for("ip") == 180
    assert MUTATION_POLICY.limit_for("user") == 60
    with pytest.raises(ValueError, match="Unsupported rate-limit subject kind"):
        MUTATION_POLICY.limit_for("invalid")


def test_subject_hash_is_stable_private_and_domain_separated() -> None:
    secret = b"x" * 32
    first = hash_rate_limit_subject(secret, "ip", "203.0.113.9")
    second = hash_rate_limit_subject(secret, "ip", "203.0.113.9")
    user_hash = hash_rate_limit_subject(secret, "user", "203.0.113.9")

    assert first == second
    assert len(first) == 64
    assert "203.0.113.9" not in first
    assert first != user_hash


def test_production_uses_vercel_forwarded_ip_before_socket_peer() -> None:
    request = _request(forwarded_for="203.0.113.9, 10.0.0.2", client_ip="10.0.0.1")
    settings = Settings(app_env="production")

    assert resolve_client_ip(request, settings) == "203.0.113.9"


def test_local_development_does_not_trust_forwarded_client_header() -> None:
    request = _request(forwarded_for="203.0.113.9", client_ip="127.0.0.1")
    settings = Settings(app_env="local")

    assert resolve_client_ip(request, settings) == "127.0.0.1"
