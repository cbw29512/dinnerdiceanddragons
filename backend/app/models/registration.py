"""Player seat requests and commitments for one Event."""

from datetime import datetime
from enum import StrEnum
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, UniqueConstraint, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class RegistrationStatus(StrEnum):
    """Canonical lifecycle states for a Player's Event registration."""

    REQUESTED = "requested"
    CONFIRMED = "confirmed"
    WAITLISTED = "waitlisted"
    DECLINED = "declined"
    CANCELLED = "cancelled"
    REMOVED = "removed"


class Registration(Base):
    """One durable Player seat relationship to one Event."""

    __tablename__ = "registrations"
    __table_args__ = (
        UniqueConstraint(
            "event_id",
            "player_profile_id",
            name="uq_registrations_event_player",
        ),
        CheckConstraint(
            "status IN ('requested', 'confirmed', 'waitlisted', 'declined', 'cancelled', 'removed')",
            name="ck_registrations_status",
        ),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    event_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("events.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    player_profile_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("player_profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
        default=RegistrationStatus.REQUESTED.value,
        server_default=RegistrationStatus.REQUESTED.value,
        index=True,
    )
    expectations_acknowledged_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    requested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    responded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
