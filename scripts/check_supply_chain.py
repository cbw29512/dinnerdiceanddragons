from __future__ import annotations

import logging
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORKFLOW_DIR = ROOT / ".github" / "workflows"
DOCKERFILE = ROOT / "backend" / "Dockerfile"
PYPROJECT = ROOT / "backend" / "pyproject.toml"

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
LOGGER = logging.getLogger("supply-chain-checks")

USES_RE = re.compile(r"^\s*-?\s*uses:\s*['\"]?([^'\"\s#]+)", re.MULTILINE)
REMOTE_ACTION_RE = re.compile(r"^[^/@\s]+/[^@\s]+@([0-9a-f]{40})$")
PINNED_FROM_RE = re.compile(r"^FROM\s+[^\s@]+@sha256:[0-9a-f]{64}(?:\s+AS\s+\S+)?$", re.MULTILINE | re.IGNORECASE)


def check_workflow_action_pins() -> list[str]:
    errors: list[str] = []
    for path in sorted((*WORKFLOW_DIR.glob("*.yml"), *WORKFLOW_DIR.glob("*.yaml"))):
        text = path.read_text(encoding="utf-8")
        for reference in USES_RE.findall(text):
            if reference.startswith("./"):
                continue
            if reference.startswith("docker://"):
                errors.append(
                    f"{path.relative_to(ROOT)}: docker action reference must be reviewed/pinned by digest: {reference}"
                )
                continue
            if not REMOTE_ACTION_RE.fullmatch(reference):
                errors.append(
                    f"{path.relative_to(ROOT)}: remote GitHub Action is not pinned to a 40-character commit SHA: {reference}"
                )
    return errors


def check_container_inputs() -> list[str]:
    errors: list[str] = []
    text = DOCKERFILE.read_text(encoding="utf-8")
    from_lines = [line.strip() for line in text.splitlines() if line.strip().upper().startswith("FROM ")]
    if not from_lines:
        errors.append("backend/Dockerfile: no FROM instruction found")
    for line in from_lines:
        if not PINNED_FROM_RE.fullmatch(line):
            errors.append(f"backend/Dockerfile: base image must be pinned by sha256 digest: {line}")
    if re.search(r"\bpip(?:3)?\s+install\b[^\n]*--upgrade\s+pip\b", text):
        errors.append("backend/Dockerfile: production build must not upgrade pip from a floating package index")
    return errors


def check_python_build_backend() -> list[str]:
    errors: list[str] = []
    text = PYPROJECT.read_text(encoding="utf-8")
    build_match = re.search(r"\[build-system\](.*?)(?:\n\[|\Z)", text, re.DOTALL)
    if not build_match:
        return ["backend/pyproject.toml: [build-system] is missing"]
    build_block = build_match.group(1)
    requires_match = re.search(r"requires\s*=\s*\[(.*?)\]", build_block, re.DOTALL)
    if not requires_match:
        return ["backend/pyproject.toml: build-system requires list is missing"]
    requirements = re.findall(r"['\"]([^'\"]+)['\"]", requires_match.group(1))
    if not requirements:
        errors.append("backend/pyproject.toml: build-system requires list is empty")
    for requirement in requirements:
        if "==" not in requirement or any(token in requirement for token in (">=", "<=", "~=", ">", "<", "*")):
            errors.append(
                "backend/pyproject.toml: build dependency must use an exact version pin: " + requirement
            )
    return errors


def check_security_governance_files() -> list[str]:
    errors: list[str] = []
    for relative in ("SECURITY.md", ".github/dependabot.yml"):
        if not (ROOT / relative).is_file():
            errors.append(f"{relative}: required supply-chain/security governance file is missing")
    return errors


def main() -> int:
    try:
        errors = [
            *check_workflow_action_pins(),
            *check_container_inputs(),
            *check_python_build_backend(),
            *check_security_governance_files(),
        ]
        if errors:
            for error in errors:
                LOGGER.error(error)
            LOGGER.error("Supply-chain immutability checks failed with %d issue(s).", len(errors))
            return 1
        LOGGER.info("Supply-chain immutability checks passed.")
        return 0
    except Exception:
        LOGGER.exception("Unexpected supply-chain validation failure")
        return 1


if __name__ == "__main__":
    sys.exit(main())
