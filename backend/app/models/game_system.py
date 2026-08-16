"""Canonical tabletop RPG system/edition catalog persistence."""

from uuid import UUID, uuid4

from sqlalchemy import Boolean, CheckConstraint, String, UniqueConstraint, Uuid, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class GameSystem(Base):
    """A canonical RPG system/edition selectable by Players and DMs."""

    __tablename__ = "game_systems"
    __table_args__ = (
        UniqueConstraint("slug", name="uq_game_systems_slug"),
        CheckConstraint(
            "length(trim(name)) BETWEEN 1 AND 120",
            name="ck_game_systems_name_length",
        ),
        CheckConstraint(
            "edition IS NULL OR length(trim(edition)) BETWEEN 1 AND 80",
            name="ck_game_systems_edition_length",
        ),
        CheckConstraint(
            "length(trim(slug)) BETWEEN 1 AND 160",
            name="ck_game_systems_slug_length",
        ),
        CheckConstraint("slug = lower(slug)", name="ck_game_systems_slug_lowercase"),
        CheckConstraint(
            "publisher_name IS NULL OR length(trim(publisher_name)) BETWEEN 1 AND 160",
            name="ck_game_systems_publisher_name_length",
        ),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    edition: Mapped[str | None] = mapped_column(String(80), nullable=True)
    slug: Mapped[str] = mapped_column(String(160), nullable=False)
    publisher_name: Mapped[str | None] = mapped_column(String(160), nullable=True)
    active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default=text("true"),
    )
