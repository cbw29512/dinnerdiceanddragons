"""Shared state values for production Table Match demand and supply signals."""

from enum import StrEnum


class SignalStatus(StrEnum):
    """Lifecycle state shared by Player demand and GM supply signals."""

    ACTIVE = "active"
    PAUSED = "paused"
    MATCHED = "matched"
    EXPIRED = "expired"
