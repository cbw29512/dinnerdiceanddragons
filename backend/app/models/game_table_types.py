"""Canonical persistent GameTable lifecycle and policy values."""

from enum import StrEnum


class GameTableStatus(StrEnum):
    """Small lifecycle state; missing resources are calculated separately."""

    DRAFT = "draft"
    FORMING = "forming"
    READY = "ready"
    CONFIRMED = "confirmed"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    ARCHIVED = "archived"


class GameTableFormat(StrEnum):
    """Concrete format for a forming or active Table."""

    LEARN_TO_PLAY = "learn_to_play"
    ONE_SHOT = "one_shot"
    SHORT_CAMPAIGN = "short_campaign"
    LONG_CAMPAIGN = "long_campaign"
    ORGANIZED_PLAY = "organized_play"


class GameTableJoinPolicy(StrEnum):
    """How a Player may obtain persistent Table membership."""

    OPEN = "open"
    REQUEST = "request"
    INVITE_ONLY = "invite_only"


class GameTableVisibility(StrEnum):
    """Discovery visibility for a Table without exposing private identities."""

    PUBLIC = "public"
    UNLISTED = "unlisted"
    PRIVATE = "private"


__all__ = [
    "GameTableFormat",
    "GameTableJoinPolicy",
    "GameTableStatus",
    "GameTableVisibility",
]
