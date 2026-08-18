"""One-to-one table expectations attached to a production Event."""

from uuid import UUID, uuid4

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, String, Text, Uuid, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class TableExpectations(Base):
    """Player-facing expectations and safety context for one Event."""

    __tablename__ = "table_expectations"
    __table_args__ = (
        CheckConstraint(
            "length(trim(play_style)) BETWEEN 1 AND 2000",
            name="ck_table_expectations_play_style",
        ),
        CheckConstraint(
            "length(trim(boundaries)) BETWEEN 1 AND 4000",
            name="ck_table_expectations_boundaries",
        ),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    event_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("events.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    tone: Mapped[str | None] = mapped_column(String(200), nullable=True)
    age_environment: Mapped[str | None] = mapped_column(String(120), nullable=True)
    play_style: Mapped[str] = mapped_column(Text, nullable=False)
    boundaries: Mapped[str] = mapped_column(Text, nullable=False)
    pvp_policy: Mapped[str | None] = mapped_column(String(300), nullable=True)
    homebrew_policy: Mapped[str | None] = mapped_column(Text, nullable=True)
    character_death_policy: Mapped[str | None] = mapped_column(String(500), nullable=True)
    mature_content_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    alcohol_policy: Mapped[str | None] = mapped_column(String(500), nullable=True)
    new_players_welcome: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default=text("true"),
    )
    break_policy: Mapped[str | None] = mapped_column(String(500), nullable=True)
    safety_framework: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    environment_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    accessibility_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    other_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
