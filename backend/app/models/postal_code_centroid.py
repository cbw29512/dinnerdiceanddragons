"""Server-side cache of privacy-preserving U.S. ZIP-code centroids."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Float,
    Numeric,
    String,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class PostalCodeCentroid(Base):
    """Cached public centroid used for approximate private travel matching."""

    __tablename__ = "postal_code_centroids"
    __table_args__ = (
        UniqueConstraint(
            "country_code",
            "postal_code",
            name="uq_postal_code_centroids_country_postal",
        ),
        CheckConstraint(
            "country_code = 'US'",
            name="ck_postal_code_centroids_country_us",
        ),
        CheckConstraint(
            "length(postal_code) = 5",
            name="ck_postal_code_centroids_postal_length",
        ),
        CheckConstraint(
            "latitude BETWEEN -90 AND 90",
            name="ck_postal_code_centroids_latitude_range",
        ),
        CheckConstraint(
            "longitude BETWEEN -180 AND 180",
            name="ck_postal_code_centroids_longitude_range",
        ),
        CheckConstraint(
            "accuracy >= 0 AND accuracy <= 1",
            name="ck_postal_code_centroids_accuracy_range",
        ),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    country_code: Mapped[str] = mapped_column(String(2), nullable=False, default="US")
    postal_code: Mapped[str] = mapped_column(String(5), nullable=False, index=True)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    provider: Mapped[str] = mapped_column(String(32), nullable=False)
    accuracy: Mapped[float] = mapped_column(Numeric(4, 3), nullable=False)
    accuracy_type: Mapped[str] = mapped_column(String(32), nullable=False)
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
