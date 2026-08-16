"""Production Player demand signals used by Table Match."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import JSON, CheckConstraint, DateTime, ForeignKey, SmallInteger, String, Uuid, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.matching_signal import SignalStatus
from app.models.player_profile import PreferredGameFormat


class PlayerDemandSignal(Base):
    """One active or historical statement of what a Player wants to join."""

    __tablename__ = "player_demand_signals"
    __table_args__ = (
        CheckConstraint(
            "preferred_format IN "
            "('any', 'learn_to_play', 'one_shot', 'short_campaign', "
            "'long_campaign', 'organized_play')",
            name="ck_player_demand_signals_preferred_format",
        ),
        CheckConstraint(
            "status IN ('active', 'paused', 'matched', 'expired')",
            name="ck_player_demand_signals_status",
        ),
        CheckConstraint(
            "minimum_age_preference IS NULL OR minimum_age_preference >= 0",
            name="ck_player_demand_signals_minimum_age",
        ),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    player_profile_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("player_profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    game_system_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("game_systems.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    preferred_format: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default=PreferredGameFormat.ANY.value,
        server_default=PreferredGameFormat.ANY.value,
    )
    preferred_cadence: Mapped[str | None] = mapped_column(String(32), nullable=True)
    minimum_age_preference: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    table_style_preferences: Mapped[list[str]] = mapped_column(
        JSON,
        nullable=False,
        default=list,
        server_default=text("'[]'"),
    )
    environment_preferences: Mapped[list[str]] = mapped_column(
        JSON,
        nullable=False,
        default=list,
        server_default=text("'[]'"),
    )
    status: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
        default=SignalStatus.ACTIVE.value,
        server_default=SignalStatus.ACTIVE.value,
        index=True,
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
