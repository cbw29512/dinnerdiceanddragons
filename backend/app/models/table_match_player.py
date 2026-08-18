"""Compatible Player facts attached to persisted Table Matches."""

from decimal import Decimal
from enum import StrEnum
from uuid import UUID

from sqlalchemy import JSON, CheckConstraint, ForeignKey, Numeric, String, Uuid, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class TableMatchPlayerStatus(StrEnum):
    """Lifecycle states for one compatible Player within a Table Match."""

    ELIGIBLE = "eligible"
    NOTIFIED = "notified"
    INTERESTED = "interested"
    DECLINED = "declined"
    COMMITTED = "committed"


class TableMatchPlayer(Base):
    """One Player demand signal evaluated as compatible with a Table Match."""

    __tablename__ = "table_match_players"
    __table_args__ = (
        CheckConstraint(
            "status IN ('eligible', 'notified', 'interested', 'declined', 'committed')",
            name="ck_table_match_players_status",
        ),
        CheckConstraint(
            "distance_miles >= 0",
            name="ck_table_match_players_distance_miles",
        ),
    )

    table_match_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("table_matches.id", ondelete="CASCADE"),
        primary_key=True,
    )
    player_demand_signal_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("player_demand_signals.id", ondelete="CASCADE"),
        primary_key=True,
        index=True,
    )
    fit_flags: Mapped[list[str]] = mapped_column(
        JSON,
        nullable=False,
        default=list,
        server_default=text("'[]'"),
    )
    distance_miles: Mapped[Decimal] = mapped_column(Numeric(8, 2), nullable=False)
    availability_overlap: Mapped[dict[str, object]] = mapped_column(
        JSON,
        nullable=False,
        default=dict,
        server_default=text("'{}'"),
    )
    status: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
        default=TableMatchPlayerStatus.ELIGIBLE.value,
        server_default=TableMatchPlayerStatus.ELIGIBLE.value,
        index=True,
    )
