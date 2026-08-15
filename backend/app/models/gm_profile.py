"""Production Dungeon Master profile persistence."""

from uuid import UUID, uuid4

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, Integer, String, Text, UniqueConstraint, Uuid, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class GMProfile(Base):
    """Private durable matching profile for one DDD Dungeon Master identity."""

    __tablename__ = "gm_profiles"
    __table_args__ = (
        UniqueConstraint("user_id", name="uq_gm_profiles_user_id"),
        CheckConstraint(
            "travel_radius_miles BETWEEN 1 AND 100",
            name="ck_gm_profiles_travel_radius_miles",
        ),
        CheckConstraint(
            "length(postal_code) = 5",
            name="ck_gm_profiles_postal_code_length",
        ),
        CheckConstraint(
            "length(trim(gm_style)) BETWEEN 1 AND 2000",
            name="ck_gm_profiles_gm_style_length",
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
    beginner_friendly: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default=text("false"),
    )
    gm_style: Mapped[str] = mapped_column(Text, nullable=False)
