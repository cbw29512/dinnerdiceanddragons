from __future__ import annotations

import logging
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
LOGGER = logging.getLogger("site-checks")


class PageParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.links: list[str] = []
        self.scripts: list[str] = []
        self.has_main = False
        self.has_skip_link = False
        self.has_description = False
        self.in_title = False
        self.title_text = ""

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        if tag == "a" and values.get("href"):
            self.links.append(values["href"] or "")
            if "skip-link" in (values.get("class") or "").split():
                self.has_skip_link = True
        elif tag == "script" and values.get("src"):
            self.scripts.append(values["src"] or "")
        elif tag == "main":
            self.has_main = True
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


def resolve_local(page: Path, raw_url: str) -> Path | None:
    try:
        parsed = urlsplit(raw_url)
        if parsed.scheme or parsed.netloc or raw_url.startswith(("mailto:", "tel:", "javascript:")):
            return None
        path_text = unquote(parsed.path)
        if not path_text:
            return None
        target = (page.parent / path_text).resolve()
        if path_text.endswith("/"):
            target /= "index.html"
        return target
    except Exception as exc:
        LOGGER.error("Could not resolve link %r from %s: %s", raw_url, page.relative_to(ROOT), exc)
        return Path("/__invalid__")


def check_page(page: Path) -> list[str]:
    errors: list[str] = []
    try:
        parser = PageParser()
        parser.feed(page.read_text(encoding="utf-8"))
        relative = page.relative_to(ROOT)

        if not parser.title_text:
            errors.append(f"{relative}: missing non-empty <title>")
        if not parser.has_description:
            errors.append(f"{relative}: missing meta description")
        if not parser.has_main:
            errors.append(f"{relative}: missing <main> landmark")
        if not parser.has_skip_link:
            errors.append(f"{relative}: missing .skip-link")

        for raw_url in [*parser.links, *parser.scripts]:
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
    except Exception as exc:
        LOGGER.exception("Failed to inspect %s", page)
        errors.append(f"{page.relative_to(ROOT)}: parser failure: {exc}")
    return errors


def main() -> int:
    try:
        pages = sorted(ROOT.rglob("*.html"))
        if not pages:
            LOGGER.error("No HTML pages found.")
            return 1

        all_errors: list[str] = []
        for page in pages:
            LOGGER.info("Checking %s", page.relative_to(ROOT))
            all_errors.extend(check_page(page))

        if all_errors:
            for error in all_errors:
                LOGGER.error(error)
            LOGGER.error("Static site QA failed with %d issue(s).", len(all_errors))
            return 1

        LOGGER.info("Static site QA passed for %d HTML page(s).", len(pages))
        return 0
    except Exception:
        LOGGER.exception("Unexpected site-check failure")
        return 1


if __name__ == "__main__":
    sys.exit(main())
