"""Human-readable table expectations attached to one Event."""

from uuid import UUID, uuid4

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, String, Text, UniqueConstraint, Uuid, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class TableExpectations(Base):
    """Shared social and safety expectations acknowledged before commitment."""

    __tablename__ = "table_expectations"
    __table_args__ = (
        UniqueConstraint("event_id", name="uq_table_expectations_event_id"),
        CheckConstraint(
            "tone IS NULL OR length(trim(tone)) BETWEEN 1 AND 80",
            name="ck_table_expectations_tone_length",
        ),
        CheckConstraint(
            "age_expectation IS NULL OR length(trim(age_expectation)) BETWEEN 1 AND 120",
            name="ck_table_expectations_age_length",
        ),
        CheckConstraint(
            "table_style IS NULL OR length(trim(table_style)) BETWEEN 1 AND 160",
            name="ck_table_expectations_style_length",
        ),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    event_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("events.id", ondelete="CASCADE"),
        nullable=False,
    )
    tone: Mapped[str | None] = mapped_column(String(80), nullable=True)
    age_expectation: Mapped[str | None] = mapped_column(String(120), nullable=True)
    table_style: Mapped[str | None] = mapped_column(String(160), nullable=True)
    pvp_policy: Mapped[str | None] = mapped_column(String(120), nullable=True)
    homebrew_policy: Mapped[str | None] = mapped_column(String(200), nullable=True)
    character_death_policy: Mapped[str | None] = mapped_column(String(200), nullable=True)
    mature_content_policy: Mapped[str | None] = mapped_column(String(200), nullable=True)
    alcohol_policy: Mapped[str | None] = mapped_column(String(200), nullable=True)
    new_players_welcome: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default=text("true"),
    )
    break_policy: Mapped[str | None] = mapped_column(String(200), nullable=True)
    safety_framework: Mapped[str | None] = mapped_column(Text, nullable=True)
    environment_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    accessibility_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    other_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
