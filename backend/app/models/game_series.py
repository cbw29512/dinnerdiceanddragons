"""Durable recurring or multi-session game series state."""

from datetime import date
from uuid import UUID, uuid4

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, Integer, String, UniqueConstraint, Uuid, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class GameSeries(Base):
    """One GM-led game series that may generate independent Event occurrences."""

    __tablename__ = "game_series"
    __table_args__ = (
        UniqueConstraint("table_match_id", name="uq_game_series_table_match_id"),
        UniqueConstraint("recurring_rule_id", name="uq_game_series_recurring_rule_id"),
        CheckConstraint(
            "length(trim(title)) BETWEEN 1 AND 200",
            name="ck_game_series_title_length",
        ),
        CheckConstraint(
            "expected_sessions >= 1",
            name="ck_game_series_expected_sessions",
        ),
        CheckConstraint(
            "ends_on IS NULL OR starts_on <= ends_on",
            name="ck_game_series_date_order",
        ),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    table_match_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey("table_matches.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
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
    recurring_rule_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey("recurring_availability_rules.id", ondelete="SET NULL"),
        nullable=True,
    )
    expected_sessions: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=1,
        server_default=text("1"),
    )
    starts_on: Mapped[date] = mapped_column(nullable=False)
    ends_on: Mapped[date | None] = mapped_column(nullable=True)
    active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default=text("true"),
    )
