"""Durable audit evidence for privileged Moderator/Admin actions."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class PrivilegedAuditEvent(Base):
    """Append-only evidence for a privileged server-authorized action."""

    __tablename__ = "privileged_audit_events"
    __table_args__ = (
        CheckConstraint(
            "actor_role IN ('moderator', 'admin')",
            name="ck_privileged_audit_events_actor_role",
        ),
        CheckConstraint(
            "outcome IN ('success', 'denied', 'error')",
            name="ck_privileged_audit_events_outcome",
        ),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    actor_user_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    actor_role: Mapped[str] = mapped_column(String(32), nullable=False)
    action: Mapped[str] = mapped_column(String(120), nullable=False)
    target_type: Mapped[str] = mapped_column(String(80), nullable=False)
    target_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    outcome: Mapped[str] = mapped_column(String(16), nullable=False)
    reason_code: Mapped[str | None] = mapped_column(String(80), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
