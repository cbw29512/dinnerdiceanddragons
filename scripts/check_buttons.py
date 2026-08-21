from __future__ import annotations

import logging
import sys
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PRODUCTION_PAGES = (
    "index.html", "play.html", "dm.html", "host.html", "signin.html", "my-ddd.html",
    "notifications.html", "opportunity.html", "create-game.html", "game-hub.html",
)
GUIDED_CONTROLLERS = ("player-start.js", "dm-start.js", "host-start.js")
PAGE_SCRIPTS = {
    "index.html": ("production-config.js", "production-api-client.js", "production-auth.js", "auth-confirm.js"),
    "play.html": (
        "production-auth.js", "production-onboarding.js", "production-matching.js",
        "availability-calendar-init.mjs", "player-start-profile.js", "player-start-account.js",
        "player-start-save.js", "player-start.js",
    ),
    "dm.html": (
        "production-auth.js", "production-onboarding.js", "production-matching.js",
        "availability-calendar-init.mjs", "dm-start-profile.js", "dm-start-account.js",
        "dm-start-save.js", "dm-start.js",
    ),
    "host.html": (
        "production-auth.js", "venue-window-payloads.js", "production-onboarding.js",
        "availability-calendar-init.mjs", "host-managed-venues.js", "host-start-account.js", "host-start.js",
    ),
    "signin.html": ("production-auth.js", "signin.js"),
    "my-ddd.html": ("production-auth.js", "my-ddd.js", "my-ddd-games.js", "my-ddd-reminders.js"),
    "notifications.html": ("production-auth.js", "notifications.js"),
    "opportunity.html": ("production-auth.js", "production-seat-actions.js", "opportunity-review.js"),
    "create-game.html": ("production-auth.js", "create-game.js"),
    "game-hub.html": (
        "production-auth.js", "game-hub-core.js", "game-hub-announcements.js", "game-hub-actions.js",
        "game-hub-role-views.js", "game-hub-render.js", "game-hub.js",
    ),
}
SOURCE_WIRING = {
    "production-auth.js": ("confirmation_token", 'credentials: "same-origin"', "DDDProductionAPI.configure", "didConfirmEmail"),
    "auth-confirm.js": ("DDDProductionAuth.didConfirmEmail", "signin.html?confirmed=1"),
    "signin.js": ('params.get("confirmed") === "1"', "Email confirmed. Sign in to continue."),
    "availability-calendar-init.mjs": ("AvailabilityCalendar", "enhanceAvailabilityPresets", ".availability-builder"),
    "availability-presets.mjs": ("Weeknights 6–10 PM", "Saturday 6–10 PM", "calendar.addBlock"),
    "player-start-account.js": ("DDDProductionAuth.signIn", "DDDProductionAuth.signUp", "lockSignedIn"),
    "player-start-profile.js": ("calendar.loadBlocks", "updatePayload", "accessibility_notes_private"),
    "player-start-save.js": ('DDDProductionOnboarding.save("Player"', "syncAndFind", "renderReview"),
    "player-start.js": ("availabilityReady", "DDDPlayerStartSave.persist", "getPlayerOnboardingOptional"),
    "dm-start-account.js": ("DDDProductionAuth.signIn", "DDDProductionAuth.signUp", "lockSignedIn"),
    "dm-start-profile.js": ("calendar.loadBlocks", "refreshSupplies", "updatePayload"),
    "dm-start-save.js": ('DDDProductionOnboarding.save("Game Master"', "refreshSupplies", "renderReview"),
    "dm-start.js": ("availabilityReady", "DDDDMStartSave.persist", "getGMOnboardingOptional"),
    "host-start-account.js": ("DDDProductionAuth.signIn", "DDDProductionAuth.signUp", "lockSignedIn"),
    "host-managed-venues.js": ("calendar.loadBlocks", "replacementPayload", "Change Calendar"),
    "host-start.js": ("getManagedVenues", "getVenueTableWindows", "putVenueTableWindows", 'DDDProductionOnboarding.save("Venue"'),
    "my-ddd.js": ("matching_paused", "putNotificationPreferences", "dm.html?edit=1"),
    "notifications.js": ("getNotifications", "opportunity.html?", "getNotificationPreferences"),
    "opportunity-review.js": ("respondToOpportunity", "Not This One", "create-game.html?table_match_id="),
    "production-seat-actions.js": ("Request My Seat", "postRegistration", "game-hub.html?event="),
    "create-game.js": ("getMatchingOpportunity", "formTableMatch", "game-hub.html?event="),
    "game-hub-announcements.js": ("can_post_announcement", "postAnnouncement", "one-way table information"),
    "game-hub-actions.js": ("getGameHub", "decideVenueBooking"),
    "netlify/functions/_lib/event-location-view.mjs": ("publicCapabilities", "can_post_announcement", "can_manage_registrations", "can_manage_booking"),
}
logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
LOGGER = logging.getLogger("button-checks")


class Parser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.form_depth = 0
        self.buttons: list[tuple[dict[str, str], bool]] = []
        self.button_links: list[dict[str, str]] = []
        self.scripts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = {key: value or "" for key, value in attrs}
        if tag == "form": self.form_depth += 1
        elif tag == "button": self.buttons.append((values, self.form_depth > 0))
        elif tag == "a" and "button" in values.get("class", "").split(): self.button_links.append(values)
        elif tag == "script" and values.get("src"): self.scripts.append(values["src"])

    def handle_endtag(self, tag: str) -> None:
        if tag == "form" and self.form_depth: self.form_depth -= 1


def parse(page: Path) -> Parser:
    parser = Parser()
    parser.feed(page.read_text(encoding="utf-8"))
    return parser


def check_page(page: Path) -> list[str]:
    errors: list[str] = []
    parser = parse(page)
    for attrs, in_form in parser.buttons:
        kind = attrs.get("type", "").lower()
        descriptor = attrs.get("id") or attrs.get("class") or "<button>"
        if kind not in {"button", "submit", "reset"}: errors.append(f"{page.name}: button {descriptor!r} needs an explicit valid type")
        if kind in {"submit", "reset"} and not in_form: errors.append(f"{page.name}: {kind} button {descriptor!r} is outside a form")
        if kind == "button" and not (attrs.get("id") or attrs.get("class") or any(key.startswith("data-") for key in attrs)): errors.append(f"{page.name}: type=button {descriptor!r} has no JS hook")
    for attrs in parser.button_links:
        if attrs.get("href", "").strip() in {"", "#"}: errors.append(f"{page.name}: button-style link has no destination")
    required_scripts = PAGE_SCRIPTS.get(page.name, ())
    positions: list[int] = []
    for required in required_scripts:
        if required not in parser.scripts:
            errors.append(f"{page.name}: required script missing: {required}")
        else:
            positions.append(parser.scripts.index(required))
    if len(positions) == len(required_scripts) and positions != sorted(positions):
        errors.append(f"{page.name}: required scripts are not loaded in the declared dependency order")
    return errors


def check_sources() -> list[str]:
    errors: list[str] = []
    for name, snippets in SOURCE_WIRING.items():
        try: text = (ROOT / name).read_text(encoding="utf-8")
        except Exception as exc:
            errors.append(f"{name}: could not read source: {exc}")
            continue
        for snippet in snippets:
            if snippet not in text: errors.append(f"{name}: expected wiring missing: {snippet}")
    for name in GUIDED_CONTROLLERS:
        line_count = len((ROOT / name).read_text(encoding="utf-8").splitlines())
        if line_count > 150: errors.append(f"{name}: guided controller exceeds 150 lines ({line_count})")
    api = (ROOT / "production-api-client.js").read_text(encoding="utf-8")
    for forbidden in ("getHubMessages", "postHubMessage", '/messages"'):
        if forbidden in api: errors.append(f"production-api-client.js: direct messaging wiring remains: {forbidden}")
    if (ROOT / "game-hub-messages.js").exists(): errors.append("game-hub-messages.js must not exist")
    legacy_channels = ("post_channels", "table_discussion", "gm_venue", "player_gm", "player_venue_question")
    for name in ("game-hub-core.js", "netlify/functions/_lib/event-location-view.mjs"):
        text = (ROOT / name).read_text(encoding="utf-8")
        for forbidden in legacy_channels:
            if forbidden in text: errors.append(f"{name}: legacy direct-message capability remains: {forbidden}")
    for name in ("host.html", "host-start.js", "production-onboarding.js", "production-api-client.js"):
        if "private_residence" in (ROOT / name).read_text(encoding="utf-8"): errors.append(f"{name}: private-residence hosting must not be exposed")
    privacy_repo = (ROOT / "netlify/functions/_lib/privacy-repository.mjs").read_text(encoding="utf-8")
    if 'channel: eq("in_app")' not in privacy_repo: errors.append("privacy-repository.mjs: My Alerts must be constrained to in_app notifications")
    return errors


def main() -> int:
    try:
        pages = [ROOT / name for name in PRODUCTION_PAGES]
        errors = [error for page in pages for error in check_page(page)]
        errors.extend(check_sources())
        for error in errors: LOGGER.error(error)
        if errors:
            LOGGER.error("Button/security QA failed with %d issue(s).", len(errors))
            return 1
        LOGGER.info("Button/security QA passed for the production interaction surface.")
        return 0
    except Exception:
        LOGGER.exception("Unexpected button/security QA failure")
        return 1


if __name__ == "__main__":
    sys.exit(main())