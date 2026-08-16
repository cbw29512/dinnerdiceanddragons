"""Typed Player and GM availability-window persistence."""

from uuid import UUID, uuid4

from sqlalchemy import Boolean, ForeignKey, UniqueConstraint, Uuid, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class PlayerAvailabilityWindow(Base):
    """One recurring availability option owned by a Player profile."""

    __tablename__ = "player_availability_windows"
    __table_args__ = (
        UniqueConstraint(
            "recurring_rule_id",
            name="uq_player_availability_windows_recurring_rule_id",
        ),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    player_profile_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("player_profiles.id", ondelete="CASCADE"),
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
    )


class GMAvailabilityWindow(Base):
    """One recurring availability option owned by a GM profile."""

    __tablename__ = "gm_availability_windows"
    __table_args__ = (
        UniqueConstraint(
            "recurring_rule_id",
            name="uq_gm_availability_windows_recurring_rule_id",
        ),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    gm_profile_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("gm_profiles.id", ondelete="CASCADE"),
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
    )
