"""Persistent Player membership for a forming or recurring GameTable."""

from datetime import datetime
from enum import StrEnum
from uuid import UUID

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, UniqueConstraint, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class GameTablePlayerStatus(StrEnum):
    """Persistent membership state independent of one Event registration."""

    REQUESTED = "requested"
    INVITED = "invited"
    CONFIRMED = "confirmed"
    DECLINED = "declined"
    REMOVED = "removed"
    LEFT = "left"


class GameTablePlayer(Base):
    """One Player's persistent relationship to a GameTable."""

    __tablename__ = "game_table_players"
    __table_args__ = (
        UniqueConstraint(
            "game_table_id",
            "player_profile_id",
            name="uq_game_table_players_table_player",
        ),
        CheckConstraint(
            "status IN ('requested', 'invited', 'confirmed', 'declined', 'removed', 'left')",
            name="ck_game_table_players_status",
        ),
    )

    game_table_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("game_tables.id", ondelete="CASCADE"),
        primary_key=True,
    )
    player_profile_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("player_profiles.id", ondelete="CASCADE"),
        primary_key=True,
        index=True,
    )
    source_player_demand_signal_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey("player_demand_signals.id", ondelete="SET NULL"),
        nullable=True,
    )
    status: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
        default=GameTablePlayerStatus.REQUESTED.value,
        server_default=GameTablePlayerStatus.REQUESTED.value,
        index=True,
    )
    requested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    responded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
