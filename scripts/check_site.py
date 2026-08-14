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
        if not path_text:
            return page.resolve()

        target = (page.parent / path_text).resolve()
        if path_text.endswith("/"):
            target /= "index.html"
        return target
    except Exception as exc:
        LOGGER.error("Could not resolve link %r from %s: %s", raw_url, page.relative_to(ROOT), exc)
        return Path("/__invalid__")


def check_fragment(page: Path, raw_url: str, target: Path, cache: dict[Path, PageParser]) -> str | None:
    try:
        fragment = unquote(urlsplit(raw_url).fragment)
        if not fragment or target.suffix.lower() != ".html" or not target.exists():
            return None

        target_parser = cache.get(target)
        if target_parser is None:
            target_parser = parse_page(target)
            cache[target] = target_parser
        if fragment not in target_parser.fragments:
            return f"{page.relative_to(ROOT)}: broken fragment reference: {raw_url}"
        return None
    except Exception as exc:
        LOGGER.error("Could not validate fragment %r from %s: %s", raw_url, page.relative_to(ROOT), exc)
        return f"{page.relative_to(ROOT)}: fragment validation failed: {raw_url}"


def check_page(page: Path, cache: dict[Path, PageParser]) -> list[str]:
    errors: list[str] = []
    try:
        parser = cache.get(page.resolve())
        if parser is None:
            parser = parse_page(page)
            cache[page.resolve()] = parser
        relative = page.relative_to(ROOT)

        if not parser.title_text:
            errors.append(f"{relative}: missing non-empty <title>")
        if not parser.has_description:
            errors.append(f"{relative}: missing meta description")
        if not parser.has_main:
            errors.append(f"{relative}: missing <main> landmark")
        if not parser.has_skip_link:
            errors.append(f"{relative}: missing .skip-link")
        elif parser.skip_href != "#main":
            errors.append(f"{relative}: .skip-link must target #main")
        elif parser.main_id != "main" or parser.main_tabindex != "-1":
            errors.append(f"{relative}: #main skip target must include tabindex=\"-1\" for keyboard focus")

        for raw_url in [*parser.links, *parser.scripts]:
            if raw_url.strip() == "#":
                errors.append(f"{relative}: inert placeholder link: href=\"#\"")
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

            fragment_error = check_fragment(page, raw_url, target, cache)
            if fragment_error:
                errors.append(fragment_error)
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

        cache: dict[Path, PageParser] = {}
        all_errors: list[str] = []
        for page in pages:
            LOGGER.info("Checking %s", page.relative_to(ROOT))
            all_errors.extend(check_page(page, cache))

        if all_errors:
            for error in all_errors:
                LOGGER.error(error)
            LOGGER.error("Static site QA failed with %d issue(s).", len(all_errors))
            return 1

        LOGGER.info("Static site QA passed for %d HTML page(s), including fragment and skip-focus checks.", len(pages))
        return 0
    except Exception:
        LOGGER.exception("Unexpected site-check failure")
        return 1


if __name__ == "__main__":
    sys.exit(main())
