"""Application roles attached to one durable Dinner, Dice & Dragons User."""

from datetime import datetime
from enum import StrEnum
from uuid import UUID

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class UserRoleType(StrEnum):
    """Server-authorized application role keys."""

    PLAYER = "player"
    GM = "gm"
    VENUE_MANAGER = "venue_manager"
    MODERATOR = "moderator"
    ADMIN = "admin"


class UserRole(Base):
    """One role held by one durable DDD User."""

    __tablename__ = "user_roles"
    __table_args__ = (
        CheckConstraint(
            "role IN ('player', 'gm', 'venue_manager', 'moderator', 'admin')",
            name="ck_user_roles_role",
        ),
    )

    user_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    role: Mapped[str] = mapped_column(String(32), primary_key=True)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
