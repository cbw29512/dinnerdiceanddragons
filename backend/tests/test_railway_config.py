"""Config-as-code regression tests for the production API deployment."""

import tomllib
from pathlib import Path


def test_railway_config_uses_migrations_healthcheck_and_restart_policy() -> None:
    config_path = Path(__file__).resolve().parents[1] / "railway.toml"
    config = tomllib.loads(config_path.read_text(encoding="utf-8"))

    assert config["build"]["builder"] == "DOCKERFILE"
    assert config["deploy"]["preDeployCommand"] == ["alembic upgrade head"]
    assert config["deploy"]["healthcheckPath"] == "/api/v1/health"
    assert config["deploy"]["healthcheckTimeout"] == 120
    assert config["deploy"]["restartPolicyType"] == "ON_FAILURE"
    assert config["deploy"]["restartPolicyMaxRetries"] == 3
