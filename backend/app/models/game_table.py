"""Persistent Table aggregate for Dinner, Dice & Dragons."""

from datetime import datetime
from enum import StrEnum
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, SmallInteger, String, Text, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class TableLifecycleStatus(StrEnum):
    """Small lifecycle state machine; missing resources are evaluated separately."""

    DRAFT = "draft"
    FORMING = "forming"
    READY = "ready"
    CONFIRMED = "confirmed"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    ARCHIVED = "archived"


class TableGameFormat(StrEnum):
    """Canonical play formats supported by the V1 Table aggregate."""

    LEARN_TO_PLAY = "learn_to_play"
    ONE_SHOT = "one_shot"
    SHORT_CAMPAIGN = "short_campaign"
    LONG_CAMPAIGN = "long_campaign"
    ORGANIZED_PLAY = "organized_play"


class TableJoinPolicy(StrEnum):
    """How Players may become members of a Table."""

    OPEN = "open"
    REQUEST = "request"
    INVITE_ONLY = "invite_only"


class TableVisibility(StrEnum):
    """Discovery visibility without exposing private participant data."""

    PUBLIC = "public"
    UNLISTED = "unlisted"
    PRIVATE = "private"


class GameTable(Base):
    """Persistent group-forming object independent of any one scheduled Session."""

    __tablename__ = "game_tables"
    __table_args__ = (
        CheckConstraint(
            "length(trim(title)) BETWEEN 1 AND 160",
            name="ck_game_tables_title_length",
        ),
        CheckConstraint(
            "lifecycle_status IN "
            "('draft', 'forming', 'ready', 'confirmed', 'in_progress', "
            "'completed', 'cancelled', 'archived')",
            name="ck_game_tables_lifecycle_status",
        ),
        CheckConstraint(
            "game_format IN "
            "('learn_to_play', 'one_shot', 'short_campaign', "
            "'long_campaign', 'organized_play')",
            name="ck_game_tables_game_format",
        ),
        CheckConstraint(
            "join_policy IN ('open', 'request', 'invite_only')",
            name="ck_game_tables_join_policy",
        ),
        CheckConstraint(
            "visibility IN ('public', 'unlisted', 'private')",
            name="ck_game_tables_visibility",
        ),
        CheckConstraint(
            "minimum_players >= 1",
            name="ck_game_tables_minimum_players",
        ),
        CheckConstraint(
            "maximum_players >= minimum_players",
            name="ck_game_tables_player_range",
        ),
        CheckConstraint(
            "minimum_age IS NULL OR minimum_age >= 0",
            name="ck_game_tables_minimum_age",
        ),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    game_system_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("game_systems.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    created_by_user_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    lifecycle_status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=TableLifecycleStatus.DRAFT.value,
        server_default=TableLifecycleStatus.DRAFT.value,
        index=True,
    )
    game_format: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default=TableGameFormat.ONE_SHOT.value,
        server_default=TableGameFormat.ONE_SHOT.value,
    )
    minimum_players: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    maximum_players: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    join_policy: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=TableJoinPolicy.REQUEST.value,
        server_default=TableJoinPolicy.REQUEST.value,
    )
    visibility: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
        default=TableVisibility.PUBLIC.value,
        server_default=TableVisibility.PUBLIC.value,
    )
    table_style: Mapped[str | None] = mapped_column(Text, nullable=True)
    minimum_age: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    gm_profile_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey("gm_profiles.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    venue_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey("venues.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    venue_table_window_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey("venue_table_windows.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
