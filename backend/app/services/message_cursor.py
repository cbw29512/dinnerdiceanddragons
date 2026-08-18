"""Opaque cursor encoding for bounded Game Hub message pagination."""

import base64
import binascii
from datetime import datetime
from uuid import UUID


class MessageCursorError(ValueError):
    pass


def encode_message_cursor(created_at: datetime, message_id: UUID) -> str:
    raw = f"{created_at.isoformat()}|{message_id}".encode()
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def decode_message_cursor(cursor: str) -> tuple[datetime, UUID]:
    try:
        padded = cursor + "=" * (-len(cursor) % 4)
        raw = base64.urlsafe_b64decode(padded.encode()).decode()
        created_raw, message_raw = raw.rsplit("|", 1)
        created_at = datetime.fromisoformat(created_raw)
        if created_at.tzinfo is None:
            raise ValueError("cursor timestamp must be timezone-aware")
        return created_at, UUID(message_raw)
    except (ValueError, UnicodeError, binascii.Error) as exc:
        raise MessageCursorError("Invalid message cursor.") from exc


__all__ = ["MessageCursorError", "decode_message_cursor", "encode_message_cursor"]
