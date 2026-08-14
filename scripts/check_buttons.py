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
            classes = set(button.attrs.get("class", "").split()) - {"button", "primary", "secondary", "interested"}
            has_identity = bool(button.attrs.get("id") or classes or any(key.startswith("data-") for key in button.attrs))
            if not has_identity:
                errors.append(f"{relative}: type=button {descriptor!r} has no id/class/data hook for JavaScript wiring")

    for link in parser.button_links:
        href = link.get("href", "").strip()
        descriptor = link.get("id") or link.get("class") or "button link"
        if not href or href == "#":
            errors.append(f"{relative}: button-style link {descriptor!r} has no real destination")

    return errors


PAGE_SCRIPT_REQUIREMENTS: dict[str, tuple[str, ...]] = {
    "index.html": ("shared-registration.js", "shared-games.js", "dashboard.js"),
    "dashboard-prototype.html": ("dashboard.js",),
    "join.html": ("form-pilot.js", "experience-profiles.js", "availability.js", "forms.js"),
    "venues.html": ("form-pilot.js", "forms.js"),
    "create-game.html": ("form-pilot.js", "forms.js", "create-game.js"),
    "find-venue.html": ("table-match-profile.js", "table-match-calculator.js", "table-match-ui.js"),
    "recurring-match.html": ("recurring-match.js",),
    "form-series.html": ("form-series.js",),
    "series-commitments.html": ("series-commitments.js",),
    "table-lifecycle.html": ("shared-lifecycle-data.js", "shared-lifecycle-view.js", "shared-lifecycle.js", "table-lifecycle.js"),
    "game-hub.html": ("game-hub.js",),
    "venue-feedback.html": ("venue-feedback.js",),
}


SOURCE_WIRING: dict[str, tuple[str, ...]] = {
    "dashboard.js": ('.role-btn', 'addEventListener("click"', '#role-select'),
    "experience-profiles.js": ('.add-experience', '.remove-experience', 'addEventListener("click"'),
    "availability.js": ('.add-availability', '.remove-availability', 'addEventListener("click"'),
    "forms.js": ('.prototype-form', 'addEventListener("submit"', 'ddd:save-success'),
    "form-pilot.js": ('player.save', 'gm.save', 'venue.save', 'game.save'),
    "create-game.js": ('ddd:save-success', '#player-seats', '#min-players'),
    "table-match-ui.js": ('#table-match-form', 'addEventListener("click"', 'Start Forming This Table'),
    "recurring-match.js": ('#recurring-match-form', 'data-series-action', '.form-series-button'),
    "form-series.js": ('#series-form', 'addEventListener("submit"', 'series-commitments.html'),
    "series-commitments.js": ('#add-player-request', 'data-request-action', 'data-venue-action', 'data-remove-core'),
    "shared-lifecycle-view.js": ('actionButton', 'addEventListener("click"', 'Open Game Hub'),
    "shared-lifecycle.js": ('#shared-lifecycle-role', 'addEventListener("change"', 'gmManage', 'venueManage', 'playerCancel'),
    "table-lifecycle.js": ('game-hub-link', 'toggle-venue', 'add-player', 'cancel-player', 'cancel-gm', 'restore-gm', 'complete-game', 'reset-lifecycle'),
    "game-hub.js": ('.hub-role', '.quick-message', 'addEventListener("click"', 'addEventListener("submit"'),
    "venue-feedback.js": ('#venue-feedback-form', 'addEventListener("submit"'),
    "shared-registration.js": ('game.join', 'game.cancel_registration'),
    "shared-games.js": ('DDDSharedRegistration.request', 'DDDSharedRegistration.cancel', 'addEventListener("click"'),
}


def check_page_dependencies(page: Path, parser: InteractionParser) -> list[str]:
    errors: list[str] = []
    relative = page.relative_to(ROOT).as_posix()
    required = PAGE_SCRIPT_REQUIREMENTS.get(relative, ())
    loaded = set(parser.scripts)
    for script in required:
        if script not in loaded:
            errors.append(f"{relative}: interactive controls require {script}, but the page does not load it")
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
                errors.append(f"{path}: expected interaction wiring snippet is missing: {snippet}")
    return errors


def main() -> int:
    try:
        pages = sorted(ROOT.rglob("*.html"))
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
