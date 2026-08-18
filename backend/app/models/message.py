"""Persistent role-scoped Game Hub communication."""

from datetime import datetime
from enum import StrEnum
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, Text, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class MessageChannel(StrEnum):
    TABLE_ANNOUNCEMENT = "table_announcement"
    TABLE_DISCUSSION = "table_discussion"
    GM_VENUE = "gm_venue"
    PLAYER_GM = "player_gm"
    PLAYER_VENUE_QUESTION = "player_venue_question"
    SYSTEM_NOTIFICATION = "system_notification"


class MessageModerationStatus(StrEnum):
    VISIBLE = "visible"
    FLAGGED = "flagged"
    HIDDEN = "hidden"
    REMOVED = "removed"


class VenueQuestionCategory(StrEnum):
    ACCESSIBILITY = "accessibility"
    FOOD_ALLERGIES = "food_allergies"
    PARKING = "parking"
    SEATING = "seating"
    VENUE_POLICY = "venue_policy"
    OTHER = "other"


class Message(Base):
    """One persisted Game Hub message with server-enforced channel visibility."""

    __tablename__ = "messages"
    __table_args__ = (
        CheckConstraint(
            "channel_type IN ('table_announcement','table_discussion','gm_venue',"
            "'player_gm','player_venue_question','system_notification')",
            name="ck_messages_channel_type",
        ),
        CheckConstraint(
            "moderation_status IN ('visible','flagged','hidden','removed')",
            name="ck_messages_moderation_status",
        ),
        CheckConstraint("length(trim(body)) BETWEEN 1 AND 4000", name="ck_messages_body_length"),
        CheckConstraint(
            "category IS NULL OR category IN ('accessibility','food_allergies','parking','seating','venue_policy','other')",
            name="ck_messages_category",
        ),
        CheckConstraint(
            "channel_type <> 'player_venue_question' OR (venue_id IS NOT NULL AND category IS NOT NULL)",
            name="ck_messages_player_venue_fields",
        ),
        CheckConstraint(
            "channel_type <> 'gm_venue' OR venue_id IS NOT NULL",
            name="ck_messages_gm_venue_fields",
        ),
        CheckConstraint(
            "channel_type <> 'player_gm' OR recipient_user_id IS NOT NULL",
            name="ck_messages_player_gm_fields",
        ),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    event_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True
    )
    sender_user_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    channel_type: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    recipient_user_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    venue_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("venues.id", ondelete="SET NULL"), nullable=True, index=True
    )
    category: Mapped[str | None] = mapped_column(String(32), nullable=True)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), index=True
    )
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    moderation_status: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
        default=MessageModerationStatus.VISIBLE.value,
        server_default=MessageModerationStatus.VISIBLE.value,
        index=True,
    )
