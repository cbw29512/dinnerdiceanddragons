"""Self-described GM experience and supported formats by RPG system."""

from decimal import Decimal
from enum import StrEnum
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, ForeignKey, Numeric, String, Text, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class GMComfortLevel(StrEnum):
    """Canonical self-described GM comfort values from the validated UI."""

    LEARNING = "learning"
    COMFORTABLE = "comfortable"
    VERY_COMFORTABLE = "very_comfortable"
    EXPERT = "expert"


class PreferredPlayerExperience(StrEnum):
    """Structured Player-experience preference for future Table Fit matching."""

    ANY = "any"
    NEW_PLAYERS = "new_players"
    SOME_EXPERIENCE = "some_experience"
    EXPERIENCED = "experienced"


class GMGameFormat(StrEnum):
    """Canonical formats a GM is comfortable running."""

    LEARN_TO_PLAY = "learn_to_play"
    ONE_SHOT = "one_shot"
    SHORT_CAMPAIGN = "short_campaign"
    LONG_CAMPAIGN = "long_campaign"
    ORGANIZED_PLAY = "organized_play"


class GMSystemExperience(Base):
    """One GM's self-described experience with one GameSystem."""

    __tablename__ = "gm_system_experiences"
    __table_args__ = (
        UniqueConstraint(
            "gm_profile_id",
            "game_system_id",
            name="uq_gm_system_experiences_profile_system",
        ),
        CheckConstraint(
            "years_playing BETWEEN 0 AND 80",
            name="ck_gm_system_experiences_years_playing",
        ),
        CheckConstraint(
            "years_gming BETWEEN 0 AND 80",
            name="ck_gm_system_experiences_years_gming",
        ),
        CheckConstraint(
            "comfort_level IN ('learning', 'comfortable', 'very_comfortable', 'expert')",
            name="ck_gm_system_experiences_comfort_level",
        ),
        CheckConstraint(
            "preferred_player_experience IN ('any', 'new_players', 'some_experience', 'experienced')",
            name="ck_gm_system_experiences_preferred_player_experience",
        ),
        CheckConstraint(
            "experience_notes IS NULL OR length(trim(experience_notes)) BETWEEN 1 AND 2000",
            name="ck_gm_system_experiences_notes_length",
        ),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    gm_profile_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("gm_profiles.id", ondelete="CASCADE"),
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
    years_gming: Mapped[Decimal] = mapped_column(Numeric(4, 1), nullable=False)
    comfort_level: Mapped[str] = mapped_column(String(32), nullable=False)
    preferred_player_experience: Mapped[str] = mapped_column(String(32), nullable=False)
    experience_notes: Mapped[str | None] = mapped_column(Text, nullable=True)


class GMSystemFormat(Base):
    """One canonical format supported by a GM for one system experience row."""

    __tablename__ = "gm_system_formats"
    __table_args__ = (
        CheckConstraint(
            "format IN ('learn_to_play', 'one_shot', 'short_campaign', 'long_campaign', 'organized_play')",
            name="ck_gm_system_formats_format",
        ),
    )

    gm_system_experience_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("gm_system_experiences.id", ondelete="CASCADE"),
        primary_key=True,
    )
    format: Mapped[str] = mapped_column(String(32), primary_key=True)
