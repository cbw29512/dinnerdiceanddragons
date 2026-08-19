"""Persistent Table aggregate for incomplete and recurring tabletop groups."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, SmallInteger, String, Text, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.game_table_constraints import GAME_TABLE_CONSTRAINTS
from app.models.game_table_types import (
    GameTableFormat,
    GameTableJoinPolicy,
    GameTableStatus,
    GameTableVisibility,
)


class GameTable(Base):
    """Persistent group identity that can exist before GM/Venue completion."""

    __tablename__ = "game_tables"
    __table_args__ = GAME_TABLE_CONSTRAINTS

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
    source_table_match_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey("table_matches.id", ondelete="SET NULL"),
        nullable=True,
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    lifecycle_status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=GameTableStatus.DRAFT.value,
        server_default=GameTableStatus.DRAFT.value,
        index=True,
    )
    game_format: Mapped[str] = mapped_column(String(32), nullable=False)
    minimum_players: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    maximum_players: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    join_policy: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=GameTableJoinPolicy.REQUEST.value,
        server_default=GameTableJoinPolicy.REQUEST.value,
    )
    visibility: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
        default=GameTableVisibility.PUBLIC.value,
        server_default=GameTableVisibility.PUBLIC.value,
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
    proposed_start: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    proposed_end: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    timezone: Mapped[str | None] = mapped_column(String(64), nullable=True)
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


__all__ = [
    "GameTable",
    "GameTableFormat",
    "GameTableJoinPolicy",
    "GameTableStatus",
    "GameTableVisibility",
]
