"""Bounded PostgreSQL token buckets for authenticated API abuse controls."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import CheckConstraint, DateTime, Float, ForeignKey, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ApiRateLimitBucket(Base):
    """One distributed token bucket per authenticated user and policy scope."""

    __tablename__ = "api_rate_limit_buckets"
    __table_args__ = (
        CheckConstraint(
            "length(trim(scope)) BETWEEN 1 AND 48",
            name="ck_api_rate_limit_buckets_scope_length",
        ),
        CheckConstraint(
            "tokens >= 0",
            name="ck_api_rate_limit_buckets_tokens_nonnegative",
        ),
    )

    user_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    scope: Mapped[str] = mapped_column(String(48), primary_key=True)
    tokens: Mapped[float] = mapped_column(Float, nullable=False)
    last_refill_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
