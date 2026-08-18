"""Production Venue table supply windows used by Table Match."""

from uuid import UUID, uuid4

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    ForeignKey,
    SmallInteger,
    Text,
    UniqueConstraint,
    Uuid,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class VenueTableWindow(Base):
    """Recurring public-venue table capacity offered for tabletop groups."""

    __tablename__ = "venue_table_windows"
    __table_args__ = (
        UniqueConstraint(
            "recurring_rule_id",
            name="uq_venue_table_windows_recurring_rule_id",
        ),
        CheckConstraint(
            "table_count >= 1",
            name="ck_venue_table_windows_table_count",
        ),
        CheckConstraint(
            "max_people_per_table >= 1",
            name="ck_venue_table_windows_max_people",
        ),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    venue_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("venues.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    recurring_rule_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("recurring_availability_rules.id", ondelete="CASCADE"),
        nullable=False,
    )
    table_count: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    max_people_per_table: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    purchase_policy: Mapped[str | None] = mapped_column(Text, nullable=True)
    approval_required: Mapped[bool] = mapped_column(Boolean, nullable=False)
    special_support_offerings: Mapped[list[str]] = mapped_column(
        JSON,
        nullable=False,
        default=list,
        server_default=text("'[]'"),
    )
    special_support_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    environment_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default=text("true"),
        index=True,
    )
