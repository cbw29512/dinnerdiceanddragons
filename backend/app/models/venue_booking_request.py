"""Venue approval state for proposed or scheduled tabletop Events."""

from datetime import datetime
from enum import StrEnum
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class VenueBookingStatus(StrEnum):
    """Canonical Venue booking request lifecycle states."""

    REQUESTED = "requested"
    QUESTION = "question"
    APPROVED = "approved"
    DECLINED = "declined"
    CANCELLED = "cancelled"


class VenueBookingRequest(Base):
    """One Venue-capacity request associated with a forming table."""

    __tablename__ = "venue_booking_requests"
    __table_args__ = (
        UniqueConstraint("table_match_id", name="uq_venue_booking_requests_table_match_id"),
        UniqueConstraint("event_id", name="uq_venue_booking_requests_event_id"),
        CheckConstraint(
            "status IN ('requested', 'question', 'approved', 'declined', 'cancelled')",
            name="ck_venue_booking_requests_status",
        ),
        CheckConstraint(
            "requested_end > requested_start",
            name="ck_venue_booking_requests_time_order",
        ),
        CheckConstraint(
            "tables_requested >= 1",
            name="ck_venue_booking_requests_tables_requested",
        ),
        CheckConstraint(
            "expected_guests >= 1",
            name="ck_venue_booking_requests_expected_guests",
        ),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    venue_table_window_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("venue_table_windows.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    gm_profile_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("gm_profiles.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    table_match_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey("table_matches.id", ondelete="SET NULL"),
        nullable=True,
    )
    game_series_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey("game_series.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    event_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey("events.id", ondelete="SET NULL"),
        nullable=True,
    )
    requested_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    requested_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    tables_requested: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    expected_guests: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    status: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
        default=VenueBookingStatus.REQUESTED.value,
        server_default=VenueBookingStatus.REQUESTED.value,
        index=True,
    )
    venue_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    gm_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
