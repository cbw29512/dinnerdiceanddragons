"""Unit tests for opaque Game Hub message pagination cursors."""

from datetime import UTC, datetime, timedelta, timezone
from uuid import UUID

import pytest

from app.services.message_cursor import (
    MessageCursorError,
    decode_message_cursor,
    encode_message_cursor,
)

MESSAGE_ID = UUID("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")


def test_cursor_round_trip_normalizes_offset_to_utc() -> None:
    created_at = datetime(2030, 8, 23, 18, 30, tzinfo=timezone(timedelta(hours=-4)))

    cursor = encode_message_cursor(created_at, MESSAGE_ID)
    decoded_at, decoded_id = decode_message_cursor(cursor)

    assert decoded_at == datetime(2030, 8, 23, 22, 30, tzinfo=UTC)
    assert decoded_id == MESSAGE_ID


def test_cursor_encoding_treats_naive_database_value_as_utc() -> None:
    created_at = datetime(2030, 8, 23, 22, 30)

    cursor = encode_message_cursor(created_at, MESSAGE_ID)
    decoded_at, decoded_id = decode_message_cursor(cursor)

    assert decoded_at == datetime(2030, 8, 23, 22, 30, tzinfo=UTC)
    assert decoded_id == MESSAGE_ID


def test_invalid_cursor_is_rejected() -> None:
    with pytest.raises(MessageCursorError):
        decode_message_cursor("not-a-valid-cursor")
