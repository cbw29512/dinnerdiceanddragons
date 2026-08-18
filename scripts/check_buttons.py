from __future__ import annotations

import logging
import sys
from dataclasses import dataclass
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
LOGGER = logging.getLogger("button-checks")


@dataclass
class Button:
    page: Path
    attrs: dict[str, str]
    in_form: bool


class InteractionParser(HTMLParser):
    def __init__(self, page: Path) -> None:
        super().__init__()
        self.page = page
        self.form_depth = 0
        self.buttons: list[Button] = []
        self.button_links: list[dict[str, str]] = []
        self.scripts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = {key: value or "" for key, value in attrs}
        if tag == "form":
            self.form_depth += 1
        elif tag == "button":
            self.buttons.append(Button(self.page, values, self.form_depth > 0))
        elif tag == "a" and "button" in values.get("class", "").split():
            self.button_links.append(values)
        elif tag == "script" and values.get("src"):
            self.scripts.append(values["src"])

    def handle_endtag(self, tag: str) -> None:
        if tag == "form" and self.form_depth:
            self.form_depth -= 1


def parse_page(page: Path) -> InteractionParser:
    parser = InteractionParser(page)
    parser.feed(page.read_text(encoding="utf-8"))
    return parser


def script_text(path: str) -> str:
    target = (ROOT / path).resolve()
    try:
        target.relative_to(ROOT)
    except ValueError as exc:
        raise RuntimeError(f"Script path escapes repository: {path}") from exc
    return target.read_text(encoding="utf-8")


def check_generic_controls(page: Path, parser: InteractionParser) -> list[str]:
    errors: list[str] = []
    relative = page.relative_to(ROOT)

    for button in parser.buttons:
        kind = button.attrs.get("type", "").lower()
        descriptor = button.attrs.get("id") or button.attrs.get("class") or "<button>"
        if not kind:
            errors.append(f"{relative}: button {descriptor!r} is missing an explicit type")
            continue
        if kind not in {"button", "submit", "reset"}:
            errors.append(f"{relative}: button {descriptor!r} has unsupported type={kind!r}")
        if kind in {"submit", "reset"} and not button.in_form:
            errors.append(f"{relative}: {kind} button {descriptor!r} is not inside a form")
        if kind == "button":
            classes = set(button.attrs.get("class", "").split()) - {
                "button",
                "primary",
                "secondary",
                "interested",
            }
            has_identity = bool(
                button.attrs.get("id")
                or classes
                or any(key.startswith("data-") for key in button.attrs)
            )
            if not has_identity:
                errors.append(
                    f"{relative}: type=button {descriptor!r} has no id/class/data hook for JavaScript wiring"
                )

    for link in parser.button_links:
        href = link.get("href", "").strip()
        descriptor = link.get("id") or link.get("class") or "button link"
        if not href or href == "#":
            errors.append(f"{relative}: button-style link {descriptor!r} has no real destination")

    return errors


PAGE_SCRIPT_REQUIREMENTS: dict[str, tuple[str, ...]] = {
    "index.html": ("shared-registration.js", "shared-games.js"),
    "dashboard-prototype.html": ("dashboard.js",),
    "join.html": (
        "production-api-client.js",
        "production-onboarding-adapters.js",
        "production-auth.js",
        "production-onboarding.js",
        "experience-profiles.js",
        "availability.js",
        "forms.js",
    ),
    "venues.html": ("form-pilot.js", "forms.js"),
    "create-game.html": ("form-pilot.js", "forms.js", "create-game.js"),
    "find-venue.html": (
        "table-match-profile.js",
        "table-match-calculator.js",
        "table-match-ui.js",
    ),
    "recurring-match.html": ("recurring-match.js",),
    "form-series.html": ("form-series.js",),
    "series-commitments.html": ("series-commitments.js",),
    "table-lifecycle.html": (
        "shared-lifecycle-data.js",
        "shared-lifecycle-view.js",
        "shared-lifecycle.js",
        "table-lifecycle.js",
    ),
    "game-hub.html": (
        "production-api-client.js",
        "production-auth.js",
        "game-hub-core.js",
        "game-hub-messages.js",
        "game-hub-actions.js",
        "game-hub-role-views.js",
        "game-hub-render.js",
        "game-hub.js",
    ),
    "venue-feedback.html": ("venue-feedback.js",),
}


SOURCE_WIRING: dict[str, tuple[str, ...]] = {
    "dashboard.js": ('.role-btn', 'addEventListener("click"', '#role-select'),
    "experience-profiles.js": (
        '.add-experience',
        '.remove-experience',
        'addEventListener("click"',
    ),
    "availability.js": (
        '.add-availability',
        '.remove-availability',
        'addEventListener("click"',
    ),
    "forms.js": ('.prototype-form', 'addEventListener("submit"', 'ddd:save-success'),
    "form-pilot.js": ('player.save', 'gm.save', 'venue.save', 'game.save'),
    "production-auth.js": (
        'token?grant_type=password',
        'token?grant_type=refresh_token',
        'DDDProductionAPI.configure',
        'ddd-production-auth-session',
    ),
    "production-onboarding.js": (
        'ddd-auth-form',
        'DDDProductionAuth.signIn',
        'putPlayerOnboarding',
        'putGMOnboarding',
    ),
    "create-game.js": ('ddd:save-success', '#player-seats', '#min-players'),
    "table-match-ui.js": (
        '#table-match-form',
        'addEventListener("click"',
        'Start Forming This Table',
    ),
    "recurring-match.js": (
        '#recurring-match-form',
        'data-series-action',
        '.form-series-button',
    ),
    "form-series.js": (
        '#series-form',
        'addEventListener("submit"',
        'series-commitments.html',
    ),
    "series-commitments.js": (
        '#add-player-request',
        'data-request-action',
        'data-venue-action',
        'data-remove-core',
    ),
    "shared-lifecycle-view.js": (
        'actionButton',
        'addEventListener("click"',
        'Open Game Hub',
    ),
    "shared-lifecycle.js": (
        '#shared-lifecycle-role',
        'addEventListener("change"',
        'gmManage',
        'venueManage',
        'playerCancel',
    ),
    "table-lifecycle.js": (
        'game-hub-link',
        'toggle-venue',
        'add-player',
        'cancel-player',
        'cancel-gm',
        'restore-gm',
        'complete-game',
        'reset-lifecycle',
    ),
    "game-hub-core.js": (
        'DDDGameHubRuntime',
        'hub-status',
        'handleApiError',
    ),
    "game-hub-messages.js": (
        'addEventListener("submit"',
        'addEventListener("click"',
        'postHubMessage',
    ),
    "game-hub-actions.js": (
        'DDDGameHubActions',
        'getGameHubs',
        'getGameHub',
        'decideVenueBooking',
    ),
    "game-hub-role-views.js": (
        'venue-question-form',
        'cancel-seat',
        'mutateRegistration',
        'mutateBooking',
    ),
    "game-hub-render.js": (
        'hub-role-button',
        'addEventListener("click"',
        'renderMessageChannels',
    ),
    "game-hub.js": ('DDDGameHubActions.initialize',),
    "venue-feedback.js": ('#venue-feedback-form', 'addEventListener("submit"'),
    "shared-registration.js": ('game.join', 'game.cancel_registration'),
    "shared-games.js": (
        'DDDSharedRegistration.request',
        'DDDSharedRegistration.cancel',
        'addEventListener("click"',
    ),
}


def check_page_dependencies(page: Path, parser: InteractionParser) -> list[str]:
    errors: list[str] = []
    relative = page.relative_to(ROOT).as_posix()
    required = PAGE_SCRIPT_REQUIREMENTS.get(relative, ())
    loaded = set(parser.scripts)
    for script in required:
        if script not in loaded:
            errors.append(
                f"{relative}: interactive controls require {script}, but the page does not load it"
            )
    return errors


def check_source_wiring() -> list[str]:
    errors: list[str] = []
    for path, snippets in SOURCE_WIRING.items():
        target = ROOT / path
        if not target.exists():
            errors.append(f"{path}: expected interaction controller is missing")
            continue
        text = script_text(path)
        for snippet in snippets:
            if snippet not in text:
                errors.append(
                    f"{path}: expected interaction wiring snippet is missing: {snippet}"
                )
    return errors


def main() -> int:
    try:
        excluded_dirs = {
            ".git",
            ".venv",
            "node_modules",
            "playwright-report",
            "test-results",
            ".lighthouseci",
        }

        pages = sorted(
            page
            for page in ROOT.rglob("*.html")
            if not any(part in excluded_dirs for part in page.relative_to(ROOT).parts)
        )
        errors: list[str] = []
        button_count = 0
        button_link_count = 0

        for page in pages:
            parser = parse_page(page)
            button_count += len(parser.buttons)
            button_link_count += len(parser.button_links)
            errors.extend(check_generic_controls(page, parser))
            errors.extend(check_page_dependencies(page, parser))

        errors.extend(check_source_wiring())

        if errors:
            for error in errors:
                LOGGER.error(error)
            LOGGER.error("Button QA failed with %d issue(s).", len(errors))
            return 1

        LOGGER.info(
            "Button QA passed across %d HTML pages: %d <button> controls and %d button-style links inspected.",
            len(pages),
            button_count,
            button_link_count,
        )
        return 0
    except Exception:
        LOGGER.exception("Unexpected button-QA failure")
        return 1


if __name__ == "__main__":
    sys.exit(main())
