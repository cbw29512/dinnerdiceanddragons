"""Alembic infrastructure tests that do not require a live PostgreSQL server."""

import subprocess
import sys
from pathlib import Path

from alembic.config import Config
from alembic.script import ScriptDirectory

BACKEND_DIR = Path(__file__).resolve().parents[1]
ALEMBIC_INI = BACKEND_DIR / "alembic.ini"


def test_alembic_configuration_discovers_current_head() -> None:
    config = Config(str(ALEMBIC_INI))
    script = ScriptDirectory.from_config(config)

    assert Path(script.dir).resolve() == (BACKEND_DIR / "alembic").resolve()
    assert script.get_heads() == ["0003_priv_audit"]


def test_alembic_offline_upgrade_emits_identity_and_audit_tables_without_database() -> None:
    result = subprocess.run(
        [
            sys.executable,
            "-m",
            "alembic",
            "-c",
            str(ALEMBIC_INI),
            "upgrade",
            "head",
            "--sql",
        ],
        cwd=BACKEND_DIR,
        check=False,
        capture_output=True,
        text=True,
    )

    assert result.returncode == 0, result.stderr
    assert "CREATE TABLE users" in result.stdout
    assert "PRIMARY KEY (id)" in result.stdout
    assert "auth_provider_user_id" in result.stdout
    assert "CREATE TABLE user_roles" in result.stdout
    assert "PRIMARY KEY (user_id, role)" in result.stdout
    assert "CREATE TABLE privileged_audit_events" in result.stdout
    assert "privileged_audit_events_append_only" in result.stdout
    assert "deny_privileged_audit_event_mutation" in result.stdout
