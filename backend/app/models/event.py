"""Durable scheduled tabletop Event persistence."""

from datetime import datetime
from enum import StrEnum
from uuid import UUID, uuid4

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, SmallInteger, String, Text, UniqueConstraint, Uuid, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class EventStatus(StrEnum):
    """Canonical production lifecycle states for a scheduled Event."""

    DRAFT = "draft"
    VENUE_REQUESTED = "venue_requested"
    FORMING = "forming"
    CONFIRMED = "confirmed"
    FULL = "full"
    CANCELLED = "cancelled"
    COMPLETED = "completed"


class Event(Base):
    """One independently schedulable occurrence at a public Venue."""

    __tablename__ = "events"
    __table_args__ = (
        UniqueConstraint("slug", name="uq_events_slug"),
        UniqueConstraint("table_match_id", name="uq_events_table_match_id"),
        CheckConstraint("length(trim(slug)) BETWEEN 1 AND 180", name="ck_events_slug_length"),
        CheckConstraint("slug = lower(slug)", name="ck_events_slug_lowercase"),
        CheckConstraint("length(trim(title)) BETWEEN 1 AND 200", name="ck_events_title_length"),
        CheckConstraint("length(trim(event_type)) BETWEEN 1 AND 32", name="ck_events_event_type_length"),
        CheckConstraint("length(trim(join_mode)) BETWEEN 1 AND 32", name="ck_events_join_mode_length"),
        CheckConstraint(
            "status IN ('draft', 'venue_requested', 'forming', 'confirmed', 'full', 'cancelled', 'completed')",
            name="ck_events_status",
        ),
        CheckConstraint("ends_at > starts_at", name="ck_events_time_order"),
        CheckConstraint("min_players >= 1", name="ck_events_min_players"),
        CheckConstraint("max_players >= min_players", name="ck_events_player_range"),
        CheckConstraint(
            "minimum_age IS NULL OR minimum_age BETWEEN 0 AND 120",
            name="ck_events_minimum_age",
        ),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    game_series_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey("game_series.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    table_match_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey("table_matches.id", ondelete="SET NULL"),
        nullable=True,
    )
    slug: Mapped[str] = mapped_column(String(180), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    gm_profile_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("gm_profiles.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    game_system_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("game_systems.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    venue_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("venues.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    event_type: Mapped[str] = mapped_column(String(32), nullable=False)
    join_mode: Mapped[str] = mapped_column(String(32), nullable=False)
    status: Mapped[str] = mapped_column(
        String(24),
        nullable=False,
        default=EventStatus.DRAFT.value,
        server_default=EventStatus.DRAFT.value,
        index=True,
    )
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    min_players: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    max_players: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    minimum_age: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    beginner_friendly: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default=text("false"),
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
