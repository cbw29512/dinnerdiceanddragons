"""Production GM supply signals used by Table Match."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, SmallInteger, String, Text, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.gm_system_experience import GMGameFormat
from app.models.matching_signal import SignalStatus


class GMSupplySignal(Base):
    """One statement of what a GM is currently willing to run."""

    __tablename__ = "gm_supply_signals"
    __table_args__ = (
        CheckConstraint(
            "preferred_format IN "
            "('learn_to_play', 'one_shot', 'short_campaign', "
            "'long_campaign', 'organized_play')",
            name="ck_gm_supply_signals_preferred_format",
        ),
        CheckConstraint(
            "status IN ('active', 'paused', 'matched', 'expired')",
            name="ck_gm_supply_signals_status",
        ),
        CheckConstraint(
            "minimum_players >= 1",
            name="ck_gm_supply_signals_minimum_players",
        ),
        CheckConstraint(
            "maximum_players >= minimum_players",
            name="ck_gm_supply_signals_player_range",
        ),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    gm_profile_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("gm_profiles.id", ondelete="CASCADE"),
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
        default=GMGameFormat.ONE_SHOT.value,
        server_default=GMGameFormat.ONE_SHOT.value,
    )
    preferred_cadence: Mapped[str | None] = mapped_column(String(32), nullable=True)
    minimum_players: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    maximum_players: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    table_style: Mapped[str | None] = mapped_column(Text, nullable=True)
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
