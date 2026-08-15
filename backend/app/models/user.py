"""Durable Dinner, Dice & Dragons user identity model."""

from datetime import datetime
from enum import StrEnum
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class AccountStatus(StrEnum):
    """Application account states independent of the auth provider."""

    PENDING_VERIFICATION = "pending_verification"
    ACTIVE = "active"
    RESTRICTED = "restricted"
    SUSPENDED = "suspended"
    BANNED = "banned"


class User(Base):
    """One durable DDD identity that may later hold multiple application roles."""

    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint(
            "status IN ('pending_verification', 'active', 'restricted', 'suspended', 'banned')",
            name="ck_users_status",
        ),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    auth_provider_user_id: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    email: Mapped[str] = mapped_column(String(320), nullable=False, unique=True)
    email_verified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    display_name: Mapped[str | None] = mapped_column(String(80), nullable=True)
    display_name_normalized: Mapped[str | None] = mapped_column(
        String(80), nullable=True, unique=True
    )
    status: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default=AccountStatus.PENDING_VERIFICATION.value,
        server_default=AccountStatus.PENDING_VERIFICATION.value,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
