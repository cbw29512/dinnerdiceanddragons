"""Persisted three-sided Table Match opportunities."""

from datetime import datetime
from decimal import Decimal
from enum import StrEnum
from uuid import UUID, uuid4

from sqlalchemy import (
    JSON,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Numeric,
    SmallInteger,
    String,
    UniqueConstraint,
    Uuid,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class TableMatchStatus(StrEnum):
    """Lifecycle states for a persisted Table Match opportunity."""

    POTENTIAL = "potential"
    INVITED = "invited"
    FORMING = "forming"
    REJECTED = "rejected"
    EXPIRED = "expired"
    CONVERTED = "converted"


class TableMatch(Base):
    """One deterministic GM + Venue occurrence with compatible Player demand."""

    __tablename__ = "table_matches"
    __table_args__ = (
        CheckConstraint(
            "status IN ('potential', 'invited', 'forming', 'rejected', 'expired', 'converted')",
            name="ck_table_matches_status",
        ),
        CheckConstraint("proposed_end > proposed_start", name="ck_table_matches_time_order"),
        CheckConstraint("minimum_players >= 1", name="ck_table_matches_minimum_players"),
        CheckConstraint(
            "maximum_players >= minimum_players",
            name="ck_table_matches_player_range",
        ),
        CheckConstraint(
            "compatible_player_count >= 0",
            name="ck_table_matches_compatible_player_count",
        ),
        CheckConstraint(
            "fit_score >= 0 AND fit_score <= 100",
            name="ck_table_matches_fit_score",
        ),
        CheckConstraint(
            "length(timezone) >= 1 AND length(timezone) <= 64",
            name="ck_table_matches_timezone_length",
        ),
        UniqueConstraint(
            "gm_supply_signal_id",
            "venue_table_window_id",
            "proposed_start",
            "proposed_end",
            name="uq_table_matches_gm_venue_occurrence",
        ),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    gm_supply_signal_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("gm_supply_signals.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    venue_table_window_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("venue_table_windows.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    game_system_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("game_systems.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    proposed_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    proposed_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    timezone: Mapped[str] = mapped_column(String(64), nullable=False)
    minimum_players: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    maximum_players: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    compatible_player_count: Mapped[int] = mapped_column(
        SmallInteger,
        nullable=False,
        default=0,
        server_default=text("0"),
    )
    distance_summary: Mapped[dict[str, object]] = mapped_column(
        JSON,
        nullable=False,
        default=dict,
        server_default=text("'{}'"),
    )
    fit_score: Mapped[Decimal] = mapped_column(
        Numeric(5, 2),
        nullable=False,
        default=Decimal("0.00"),
        server_default=text("0"),
    )
    status: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
        default=TableMatchStatus.POTENTIAL.value,
        server_default=TableMatchStatus.POTENTIAL.value,
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
