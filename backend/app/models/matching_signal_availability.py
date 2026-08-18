"""Availability windows owned by one concrete Player demand or GM supply signal.

Profile availability remains useful as a reusable/default schedule. Matching signals need
their own typed windows so a person can truthfully say, for example, "I can run D&D on
Saturday" and "I can run Call of Cthulhu on Tuesday" without cross-matching the days.
"""

from uuid import UUID, uuid4

from sqlalchemy import Boolean, ForeignKey, UniqueConstraint, Uuid, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class PlayerDemandAvailabilityWindow(Base):
    """One recurring availability option attached to one Player demand signal."""

    __tablename__ = "player_demand_availability_windows"
    __table_args__ = (
        UniqueConstraint(
            "recurring_rule_id",
            name="uq_player_demand_availability_windows_rule_id",
        ),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    player_demand_signal_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("player_demand_signals.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    recurring_rule_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("recurring_availability_rules.id", ondelete="CASCADE"),
        nullable=False,
    )
    active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default=text("true"),
        index=True,
    )


class GMSupplyAvailabilityWindow(Base):
    """One recurring availability option attached to one GM supply signal."""

    __tablename__ = "gm_supply_availability_windows"
    __table_args__ = (
        UniqueConstraint(
            "recurring_rule_id",
            name="uq_gm_supply_availability_windows_rule_id",
        ),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    gm_supply_signal_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("gm_supply_signals.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    recurring_rule_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("recurring_availability_rules.id", ondelete="CASCADE"),
        nullable=False,
    )
    active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default=text("true"),
        index=True,
    )


__all__ = ["GMSupplyAvailabilityWindow", "PlayerDemandAvailabilityWindow"]
