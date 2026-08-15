"""Production Player profile persistence."""

from enum import StrEnum
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class PreferredGameFormat(StrEnum):
    """Canonical Player game-format preference values."""

    ANY = "any"
    LEARN_TO_PLAY = "learn_to_play"
    ONE_SHOT = "one_shot"
    SHORT_CAMPAIGN = "short_campaign"
    LONG_CAMPAIGN = "long_campaign"
    ORGANIZED_PLAY = "organized_play"


class PlayerProfile(Base):
    """Private durable matching profile for one DDD Player identity."""

    __tablename__ = "player_profiles"
    __table_args__ = (
        UniqueConstraint("user_id", name="uq_player_profiles_user_id"),
        CheckConstraint(
            "travel_radius_miles BETWEEN 1 AND 100",
            name="ck_player_profiles_travel_radius_miles",
        ),
        CheckConstraint(
            "length(postal_code) = 5",
            name="ck_player_profiles_postal_code_length",
        ),
        CheckConstraint(
            "preferred_format IN "
            "('any', 'learn_to_play', 'one_shot', 'short_campaign', "
            "'long_campaign', 'organized_play')",
            name="ck_player_profiles_preferred_format",
        ),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    postal_code: Mapped[str] = mapped_column(String(5), nullable=False)
    travel_radius_miles: Mapped[int] = mapped_column(Integer, nullable=False)
    preferred_format: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default=PreferredGameFormat.ANY.value,
        server_default=PreferredGameFormat.ANY.value,
    )
    willing_to_learn_new_system: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default=text("true"),
    )
    environment_preferences: Mapped[list[str]] = mapped_column(
        JSON,
        nullable=False,
        default=list,
        server_default=text("'[]'"),
    )
    accessibility_notes_private: Mapped[str | None] = mapped_column(Text, nullable=True)
