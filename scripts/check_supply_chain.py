from __future__ import annotations

import logging
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORKFLOW_DIR = ROOT / ".github" / "workflows"
DEPENDENCY_REVIEW_WORKFLOW = WORKFLOW_DIR / "dependency-review.yml"
DOCKERFILE = ROOT / "backend" / "Dockerfile"
PYPROJECT = ROOT / "backend" / "pyproject.toml"
REQUIREMENTS_LOCK = ROOT / "backend" / "requirements.lock"

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
LOGGER = logging.getLogger("supply-chain-checks")

USES_RE = re.compile(r"^\s*-?\s*uses:\s*['\"]?([^'\"\s#]+)", re.MULTILINE)
REMOTE_ACTION_RE = re.compile(r"^[^/@\s]+/[^@\s]+@([0-9a-f]{40})$")
PINNED_FROM_RE = re.compile(
    r"^FROM\s+[^\s@]+@sha256:[0-9a-f]{64}(?:\s+AS\s+\S+)?$",
    re.MULTILINE | re.IGNORECASE,
)
LOCKED_REQUIREMENT_RE = re.compile(r"^[A-Za-z0-9_.-]+==[^\s\\]+")


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


def check_dependency_review_gate() -> list[str]:
    if not DEPENDENCY_REVIEW_WORKFLOW.is_file():
        return [".github/workflows/dependency-review.yml: required dependency-review PR gate is missing"]

    text = DEPENDENCY_REVIEW_WORKFLOW.read_text(encoding="utf-8")
    errors: list[str] = []
    if "pull_request:" not in text:
        errors.append(".github/workflows/dependency-review.yml: gate must run on pull requests")
    if "actions/dependency-review-action@" not in text:
        errors.append(
            ".github/workflows/dependency-review.yml: GitHub dependency-review action is missing"
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
    if "COPY requirements.lock ./" not in text:
        errors.append("backend/Dockerfile: production dependency lock is not copied into the image")
    if "--require-hashes" not in text or "-r requirements.lock" not in text:
        errors.append("backend/Dockerfile: production dependencies must install from requirements.lock with --require-hashes")
    if re.search(r"pip\s+install[^\n]*\s\.\s*$", text, re.MULTILINE):
        errors.append("backend/Dockerfile: production build must not re-resolve project dependencies with 'pip install .' ")
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


def check_python_lock() -> list[str]:
    errors: list[str] = []
    if not REQUIREMENTS_LOCK.is_file():
        return ["backend/requirements.lock: committed production dependency lock is missing"]
    text = REQUIREMENTS_LOCK.read_text(encoding="utf-8")
    if "--hash=sha256:" not in text:
        errors.append("backend/requirements.lock: no SHA-256 package hashes found")
    logical_lines: list[str] = []
    current = ""
    for raw_line in text.splitlines():
        stripped = raw_line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if stripped.startswith("--") and not current:
            # Global pip options such as --index-url/--trusted-host are not package rows.
            continue
        current = f"{current} {stripped}".strip() if current else stripped
        if not stripped.endswith("\\"):
            logical_lines.append(current)
            current = ""
    if current:
        logical_lines.append(current)
    requirements = [line for line in logical_lines if LOCKED_REQUIREMENT_RE.match(line)]
    if not requirements:
        errors.append("backend/requirements.lock: no exact package requirements found")
    for requirement in requirements:
        if "--hash=sha256:" not in requirement:
            errors.append(
                "backend/requirements.lock: locked package is missing a SHA-256 hash: "
                + requirement.split()[0]
            )
    return errors


def check_security_governance_files() -> list[str]:
    errors: list[str] = []
    for relative in (
        "SECURITY.md",
        ".github/dependabot.yml",
        ".github/workflows/dependency-review.yml",
        "backend/requirements.lock",
    ):
        if not (ROOT / relative).is_file():
            errors.append(f"{relative}: required supply-chain/security file is missing")
    return errors


def main() -> int:
    try:
        errors = [
            *check_workflow_action_pins(),
            *check_dependency_review_gate(),
            *check_container_inputs(),
            *check_python_build_backend(),
            *check_python_lock(),
            *check_security_governance_files(),
        ]
        if errors:
            for error in errors:
                LOGGER.error(error)
            LOGGER.error("Supply-chain immutability checks failed with %d issue(s).", len(errors))
            return 1
        LOGGER.info("Supply-chain immutability and hash-lock checks passed.")
        return 0
    except Exception:
        LOGGER.exception("Unexpected supply-chain validation failure")
        return 1


if __name__ == "__main__":
    sys.exit(main())
