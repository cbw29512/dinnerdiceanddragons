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


AUTH_SCRIPT_REQUIREMENTS = (
    "production-config.js",
    "production-api-client.js",
    "production-session-store.js",
    "production-auth.js",
)

PAGE_SCRIPT_REQUIREMENTS: dict[str, tuple[str, ...]] = {
    "index.html": (*AUTH_SCRIPT_REQUIREMENTS, "shared-registration.js", "shared-games.js"),
    "dashboard-prototype.html": ("dashboard.js",),
    "join.html": (
        *AUTH_SCRIPT_REQUIREMENTS,
        "global-auth-ui.js",
        "production-onboarding-adapters.js",
        "production-matching.js",
        "production-onboarding.js",
        "experience-profiles.js",
        "availability.js",
        "availability-calendar-init.mjs",
        "production-opportunity-actions.js",
        "production-seat-actions.js",
        "production-match-results.js",
        "forms.js",
    ),
    "venues.html": (
        *AUTH_SCRIPT_REQUIREMENTS,
        "global-auth-ui.js",
        "production-onboarding-adapters.js",
        "venue-window-payloads.js",
        "production-onboarding.js",
        "availability.js",
        "availability-calendar-init.mjs",
        "forms.js",
    ),
    "notifications.html": (*AUTH_SCRIPT_REQUIREMENTS, "global-auth-ui.js", "global-notifications-ui.js", "notifications.js"),
    "opportunity.html": (*AUTH_SCRIPT_REQUIREMENTS, "global-auth-ui.js", "global-notifications-ui.js", "production-seat-actions.js", "opportunity-review.js"),
    "create-game.html": (*AUTH_SCRIPT_REQUIREMENTS, "global-auth-ui.js", "create-game.js"),
    "find-venue.html": ("table-match-profile.js", "table-match-calculator.js", "table-match-ui.js"),
    "recurring-match.html": ("recurring-match.js",),
    "form-series.html": ("form-series.js",),
    "series-commitments.html": ("series-commitments.js",),
    "table-lifecycle.html": ("shared-lifecycle-data.js", "shared-lifecycle-view.js", "shared-lifecycle.js", "table-lifecycle.js"),
    "game-hub.html": (
        *AUTH_SCRIPT_REQUIREMENTS,
        "global-auth-ui.js",
        "global-notifications-ui.js",
        "game-hub-core.js",
        "game-hub-announcements.js",
        "game-hub-actions.js",
        "game-hub-role-views.js",
        "game-hub-render.js",
        "game-hub.js",
    ),
    "venue-feedback.html": ("venue-feedback.js",),
}

SOURCE_WIRING: dict[str, tuple[str, ...]] = {
    "dashboard.js": ('.role-btn', 'addEventListener("click"', '#role-select'),
    "experience-profiles.js": ('.add-experience', '.remove-experience', 'addEventListener("click"'),
    "availability.js": ('.add-availability', '.remove-availability', 'addEventListener("click"'),
    "availability-calendar-init.mjs": ('AvailabilityCalendar', '.availability-builder', 'onboarding-stepper.js'),
    "calendar-view-ui.mjs": ('pointerdown', 'pointerenter', 'keydown', 'availability-chip'),
    "onboarding-stepper.js": ('ddd-step-status', 'aria-invalid', 'addEventListener("click"'),
    "forms.js": ('.prototype-form', 'addEventListener("submit"', 'ddd:save-success'),
    "form-pilot.js": ('player.save', 'gm.save', 'venue.save', 'game.save'),
    "production-config.js": ('apiBaseUrl', 'window.location.origin', 'global-notifications-ui.js'),
    "production-session-store.js": ('sessionStorage', 'localStorage.removeItem', 'DDDProductionSessionStore'),
    "production-auth.js": ('DDDProductionConfig', '/api/v1/auth/', 'credentials: "same-origin"', 'confirmation_token', 'DDDProductionAPI.configure'),
    "production-onboarding.js": ('DDDProductionOnboardingAdapters', 'ProductionAuthRequiredError', 'putPlayerOnboarding', 'putGMOnboarding', 'postVenueOnboarding'),
    "production-matching.js": ('getPlayerDemands', 'postPlayerDemand', 'getGMSupplies', 'postGMSupply', 'findMyTable', 'getMatchingOpportunities'),
    "production-match-results.js": ('DDDOpportunityActions', 'ddd:save-success', 'compatible'),
    "production-opportunity-actions.js": ('respondToOpportunity', 'Accept Match', "I'm Interested", 'Finish Event Setup'),
    "production-seat-actions.js": ('postRegistration', 'Request My Seat', 'game-hub.html?event='),
    "global-notifications-ui.js": ('getNotifications', 'ddd-notifications-link', 'Notifications'),
    "notifications.js": ('getNotifications', 'getNotificationPreferences', 'putNotificationPreferences', 'opportunity.html?match='),
    "opportunity-review.js": ('getMatchingOpportunity', 'respondToOpportunity', 'Not This One'),
    "create-game.js": ('table_match_id', 'getMatchingOpportunity', 'formTableMatch', 'game-hub.html?event='),
    "table-match-ui.js": ('#table-match-form', 'addEventListener("click"', 'Start Forming This Table'),
    "recurring-match.js": ('#recurring-match-form', 'data-series-action', '.form-series-button'),
    "form-series.js": ('#series-form', 'addEventListener("submit"', 'series-commitments.html'),
    "series-commitments.js": ('#add-player-request', 'data-request-action', 'data-venue-action', 'data-remove-core'),
    "shared-lifecycle-view.js": ('actionButton', 'addEventListener("click"', 'Open Game Hub'),
    "shared-lifecycle.js": ('#shared-lifecycle-role', 'addEventListener("change"', 'gmManage', 'venueManage', 'playerCancel'),
    "table-lifecycle.js": ('game-hub-link', 'toggle-venue', 'add-player', 'cancel-player', 'cancel-gm', 'restore-gm', 'complete-game', 'reset-lifecycle'),
    "game-hub-core.js": ('DDDGameHubRuntime', 'hub-status', 'handleApiError', 'addEventListener("click"'),
    "game-hub-announcements.js": ('getAnnouncements', 'postAnnouncement', 'hub-announcement-form'),
    "game-hub-actions.js": ('DDDGameHubActions', 'getGameHubs', 'getGameHub', 'decideVenueBooking'),
    "game-hub-role-views.js": ('cancel-seat', 'mutateRegistration', 'mutateBooking'),
    "game-hub-render.js": ('hub-role-button', 'addEventListener("click"', 'DDDGameHubAnnouncements'),
    "game-hub.js": ('DDDGameHubActions.initialize',),
    "venue-feedback.js": ('#venue-feedback-form', 'addEventListener("submit"'),
}


def check_required_scripts(page: Path, parser: InteractionParser) -> list[str]:
    errors: list[str] = []
    required = PAGE_SCRIPT_REQUIREMENTS.get(page.relative_to(ROOT).as_posix())
    if not required:
        return errors
    actual = tuple(parser.scripts)
    for script in required:
        if script not in actual:
            errors.append(f"{page.relative_to(ROOT)}: required script is missing: {script}")
    return errors


def check_source_wiring() -> list[str]:
    errors: list[str] = []
    for relative, snippets in SOURCE_WIRING.items():
        text = script_text(relative)
        for snippet in snippets:
            if snippet not in text:
                errors.append(f"{relative}: expected interaction wiring snippet is missing: {snippet}")
    api_client = script_text("production-api-client.js")
    for forbidden in ("getHubMessages", "postHubMessage"):
        if forbidden in api_client:
            errors.append(f"production-api-client.js: forbidden direct messaging API remains: {forbidden}")
    if (ROOT / "game-hub-messages.js").exists():
        errors.append("game-hub-messages.js: direct messaging client must not exist")
    return errors


def main() -> int:
    errors: list[str] = []
    for page in sorted(ROOT.glob("**/*.html")):
        if any(part in {".git", "node_modules", "dist", "playwright-report", "test-results"} for part in page.parts):
            continue
        parser = parse_page(page)
        errors.extend(check_generic_controls(page, parser))
        errors.extend(check_required_scripts(page, parser))
    errors.extend(check_source_wiring())
    if errors:
        for error in errors:
            LOGGER.error(error)
        LOGGER.error("Button/security QA failed with %s issue(s).", len(errors))
        return 1
    LOGGER.info("Button/security QA passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
