"""Production Event persistence and lifecycle states."""

from datetime import datetime
from enum import StrEnum
from uuid import UUID, uuid4

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, SmallInteger, String, Text, Uuid, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class EventStatus(StrEnum):
    DRAFT = "draft"
    VENUE_REQUESTED = "venue_requested"
    FORMING = "forming"
    CONFIRMED = "confirmed"
    FULL = "full"
    CANCELLED = "cancelled"
    COMPLETED = "completed"


class EventType(StrEnum):
    ONE_SHOT = "one_shot"
    CAMPAIGN_SESSION = "campaign_session"
    NEW_CAMPAIGN = "new_campaign"
    LEARN_TO_PLAY = "learn_to_play"
    ORGANIZED_PLAY = "organized_play"


class EventJoinMode(StrEnum):
    REQUEST_TO_JOIN = "request_to_join"
    INSTANT_JOIN = "instant_join"


class Event(Base):
    """One independently mutable scheduled tabletop occurrence."""

    __tablename__ = "events"
    __table_args__ = (
        CheckConstraint("length(trim(slug)) BETWEEN 1 AND 180", name="ck_events_slug_length"),
        CheckConstraint("slug = lower(slug)", name="ck_events_slug_lowercase"),
        CheckConstraint("length(trim(title)) BETWEEN 1 AND 200", name="ck_events_title_length"),
        CheckConstraint("ends_at > starts_at", name="ck_events_time_order"),
        CheckConstraint("min_players >= 1", name="ck_events_min_players"),
        CheckConstraint("max_players >= min_players", name="ck_events_player_range"),
        CheckConstraint(
            "minimum_age IS NULL OR minimum_age BETWEEN 0 AND 125",
            name="ck_events_minimum_age",
        ),
        CheckConstraint(
            "event_type IN ('one_shot','campaign_session','new_campaign','learn_to_play','organized_play')",
            name="ck_events_event_type",
        ),
        CheckConstraint(
            "join_mode IN ('request_to_join','instant_join')",
            name="ck_events_join_mode",
        ),
        CheckConstraint(
            "status IN ('draft','venue_requested','forming','confirmed','full','cancelled','completed')",
            name="ck_events_status",
        ),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    game_series_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("game_series.id", ondelete="SET NULL"), nullable=True, index=True
    )
    table_match_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("table_matches.id", ondelete="SET NULL"), nullable=True, unique=True
    )
    slug: Mapped[str] = mapped_column(String(180), nullable=False, unique=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    gm_profile_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("gm_profiles.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    game_system_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("game_systems.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    venue_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("venues.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    event_type: Mapped[str] = mapped_column(String(32), nullable=False)
    join_mode: Mapped[str] = mapped_column(String(32), nullable=False)
    status: Mapped[str] = mapped_column(
        String(24), nullable=False, default=EventStatus.DRAFT.value, server_default=EventStatus.DRAFT.value, index=True
    )
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    min_players: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    max_players: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    minimum_age: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    beginner_friendly: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default=text("true"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
