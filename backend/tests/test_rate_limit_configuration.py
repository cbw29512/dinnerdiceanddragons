"""Fail-closed configuration tests for deployed API rate limiting."""

import pytest

from app.core.config import Settings


def test_local_runtime_does_not_enable_distributed_rate_limiting() -> None:
    assert Settings(app_env="local").rate_limits_enabled() is False
    assert Settings(app_env="test").rate_limits_enabled() is False


def test_deployed_runtime_enables_distributed_rate_limiting() -> None:
    assert Settings(app_env="staging").rate_limits_enabled() is True
    assert Settings(app_env="production").rate_limits_enabled() is True


def test_rate_limit_hmac_key_is_required_and_minimum_length_is_enforced() -> None:
    missing = Settings(app_env="production", rate_limit_hmac_key=None)
    short = Settings(app_env="production", rate_limit_hmac_key="short-test-value")
    configured = Settings(app_env="production", rate_limit_hmac_key="x" * 32)

    with pytest.raises(ValueError, match="RATE_LIMIT_HMAC_KEY is required"):
        missing.rate_limit_secret()
    with pytest.raises(ValueError, match="at least 32 characters"):
        short.rate_limit_secret()
    assert configured.rate_limit_secret() == b"x" * 32
