"""Canonical display-name validation and normalization rules."""

from dataclasses import dataclass
import unicodedata

MAX_DISPLAY_NAME_LENGTH = 80

# Reservation keys are punctuation/spacing-insensitive canonical forms. Keep this
# list focused on platform impersonation rather than ordinary RPG terminology.
RESERVED_DISPLAY_NAME_KEYS = frozenset(
    {
        "admin",
        "administrator",
        "ddd",
        "dinnerdiceanddragons",
        "dinnerdicedragons",
        "mod",
        "moderator",
        "official",
        "staff",
        "support",
        "system",
    }
)


class DisplayNameValidationError(ValueError):
    """Raised when a proposed public display name violates DDD identity policy."""


@dataclass(frozen=True, slots=True)
class DisplayName:
    """Prepared display spelling plus its concurrency-safe comparison key."""

    display: str
    normalized: str


def _reservation_key(normalized: str) -> str:
    """Remove spacing/punctuation so reserved-name variants cannot evade checks."""

    return "".join(character for character in normalized if character.isalnum())


def prepare_display_name(value: str) -> DisplayName:
    """Validate and prepare a display name for storage.

    The returned ``display`` preserves user-facing capitalization/presentation
    after canonical Unicode and whitespace cleanup. ``normalized`` is used for
    global case-insensitive uniqueness in PostgreSQL.
    """

    canonical = unicodedata.normalize("NFKC", value)

    if any(not (character.isprintable() or character.isspace()) for character in canonical):
        raise DisplayNameValidationError("Display name contains invisible or control characters.")

    display = " ".join(canonical.split())
    if not display:
        raise DisplayNameValidationError("Display name cannot be empty.")
    if len(display) > MAX_DISPLAY_NAME_LENGTH:
        raise DisplayNameValidationError(
            f"Display name cannot exceed {MAX_DISPLAY_NAME_LENGTH} characters."
        )

    normalized = display.casefold()
    if _reservation_key(normalized) in RESERVED_DISPLAY_NAME_KEYS:
        raise DisplayNameValidationError("That display name is reserved by Dinner, Dice & Dragons.")

    return DisplayName(display=display, normalized=normalized)
