"""Self-described Player experience with a canonical RPG system/edition."""

from decimal import Decimal
from enum import StrEnum
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, ForeignKey, Numeric, String, Text, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class PlayerComfortLevel(StrEnum):
    """Canonical self-described Player comfort values.

    These values describe experience only. They are never platform reputation or
    verified expertise.
    """

    NEW = "new"
    LEARNING = "learning"
    COMFORTABLE = "comfortable"
    VERY_EXPERIENCED = "very_experienced"


class PlayerSystemExperience(Base):
    """One Player's self-described experience with one GameSystem."""

    __tablename__ = "player_system_experiences"
    __table_args__ = (
        UniqueConstraint(
            "player_profile_id",
            "game_system_id",
            name="uq_player_system_experiences_profile_system",
        ),
        CheckConstraint(
            "years_playing BETWEEN 0 AND 80",
            name="ck_player_system_experiences_years_playing",
        ),
        CheckConstraint(
            "comfort_level IN ('new', 'learning', 'comfortable', 'very_experienced')",
            name="ck_player_system_experiences_comfort_level",
        ),
        CheckConstraint(
            "experience_notes IS NULL OR length(trim(experience_notes)) BETWEEN 1 AND 2000",
            name="ck_player_system_experiences_notes_length",
        ),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    player_profile_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("player_profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    game_system_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("game_systems.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    years_playing: Mapped[Decimal] = mapped_column(Numeric(4, 1), nullable=False)
    comfort_level: Mapped[str] = mapped_column(String(32), nullable=False)
    experience_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
