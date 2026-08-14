"""Alembic infrastructure tests that do not require a live PostgreSQL server."""

from pathlib import Path
import subprocess
import sys

from alembic.config import Config
from alembic.script import ScriptDirectory


BACKEND_DIR = Path(__file__).resolve().parents[1]
ALEMBIC_INI = BACKEND_DIR / "alembic.ini"


def test_alembic_configuration_discovers_revision_tree() -> None:
    config = Config(str(ALEMBIC_INI))
    script = ScriptDirectory.from_config(config)

    assert Path(script.dir).resolve() == (BACKEND_DIR / "alembic").resolve()
    assert script.get_heads() == []


def test_alembic_offline_upgrade_imports_environment_without_database() -> None:
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
    assert "CREATE TABLE alembic_version" not in result.stdout
