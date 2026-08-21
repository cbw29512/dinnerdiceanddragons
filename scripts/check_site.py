from __future__ import annotations

import logging
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
PRODUCTION_PAGES = (
    "index.html", "play.html", "dm.html", "host.html", "signin.html", "my-ddd.html",
    "notifications.html", "opportunity.html", "create-game.html", "game-hub.html",
    "join.html", "venues.html", "conduct.html",
)
logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
LOGGER = logging.getLogger("site-checks")


class PageParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.links: list[str] = []
        self.scripts: list[str] = []
        self.fragments: set[str] = set()
        self.has_main = False
        self.main_id = ""
        self.main_tabindex = ""
        self.has_skip_link = False
        self.skip_href = ""
        self.has_description = False
        self.in_title = False
        self.title_text = ""

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        element_id = values.get("id")
        if element_id:
            self.fragments.add(element_id)
        if tag == "a" and values.get("name"):
            self.fragments.add(values["name"] or "")
        if tag == "a" and values.get("href"):
            self.links.append(values["href"] or "")
            if "skip-link" in (values.get("class") or "").split():
                self.has_skip_link = True
                self.skip_href = values.get("href") or ""
        elif tag == "script" and values.get("src"):
            self.scripts.append(values["src"] or "")
        elif tag == "main":
            self.has_main = True
            self.main_id = values.get("id") or ""
            self.main_tabindex = values.get("tabindex") or ""
        elif tag == "meta" and values.get("name", "").lower() == "description" and values.get("content"):
            self.has_description = True
        elif tag == "title":
            self.in_title = True

    def handle_endtag(self, tag: str) -> None:
        if tag == "title":
            self.in_title = False

    def handle_data(self, data: str) -> None:
        if self.in_title:
            self.title_text += data.strip()


def parse_page(page: Path) -> PageParser:
    try:
        parser = PageParser()
        parser.feed(page.read_text(encoding="utf-8"))
        return parser
    except Exception:
        LOGGER.exception("Failed to parse %s", page.relative_to(ROOT))
        raise


def resolve_local(page: Path, raw_url: str) -> Path | None:
    try:
        parsed = urlsplit(raw_url)
        if parsed.scheme or parsed.netloc or raw_url.startswith(("mailto:", "tel:", "javascript:")):
            return None
        path_text = unquote(parsed.path)
        target = page.resolve() if not path_text else (page.parent / path_text).resolve()
        return target / "index.html" if path_text.endswith("/") else target
    except Exception as exc:
        LOGGER.error("Could not resolve %r from %s: %s", raw_url, page.relative_to(ROOT), exc)
        return Path("/__invalid__")


def check_page(page: Path, cache: dict[Path, PageParser]) -> list[str]:
    errors: list[str] = []
    try:
        parser = cache.setdefault(page.resolve(), parse_page(page))
        relative = page.relative_to(ROOT)
        if not parser.title_text:
            errors.append(f"{relative}: missing non-empty <title>")
        if not parser.has_description:
            errors.append(f"{relative}: missing meta description")
        if not parser.has_main:
            errors.append(f"{relative}: missing <main> landmark")
        if not parser.has_skip_link or parser.skip_href != "#main":
            errors.append(f"{relative}: .skip-link must target #main")
        if parser.main_id != "main" or parser.main_tabindex != "-1":
            errors.append(f"{relative}: #main must include tabindex=\"-1\"")
        for raw_url in [*parser.links, *parser.scripts]:
            if raw_url.strip() == "#":
                errors.append(f"{relative}: inert placeholder link")
                continue
            target = resolve_local(page, raw_url)
            if target is None:
                continue
            try:
                target.relative_to(ROOT)
            except ValueError:
                errors.append(f"{relative}: local reference escapes repository: {raw_url}")
                continue
            if not target.exists():
                errors.append(f"{relative}: broken local reference: {raw_url}")
                continue
            fragment = unquote(urlsplit(raw_url).fragment)
            if fragment and target.suffix.lower() == ".html":
                target_parser = cache.setdefault(target, parse_page(target))
                if fragment not in target_parser.fragments:
                    errors.append(f"{relative}: broken fragment reference: {raw_url}")
    except Exception as exc:
        LOGGER.exception("Failed to inspect %s", page)
        errors.append(f"{page.relative_to(ROOT)}: parser failure: {exc}")
    return errors


def main() -> int:
    try:
        pages = [ROOT / name for name in PRODUCTION_PAGES]
        missing = [page.name for page in pages if not page.exists()]
        if missing:
            LOGGER.error("Required production pages are missing: %s", ", ".join(missing))
            return 1
        cache: dict[Path, PageParser] = {}
        errors = [error for page in pages for error in check_page(page, cache)]
        for error in errors:
            LOGGER.error(error)
        if errors:
            LOGGER.error("Static site QA failed with %d issue(s).", len(errors))
            return 1
        LOGGER.info("Static site QA passed for %d production page(s).", len(pages))
        return 0
    except Exception:
        LOGGER.exception("Unexpected site-check failure")
        return 1


if __name__ == "__main__":
    sys.exit(main())