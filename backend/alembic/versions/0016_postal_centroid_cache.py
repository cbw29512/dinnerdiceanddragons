"""create server-side U.S. ZIP centroid cache

Revision ID: 0016_postal_centroid_cache
Revises: 0015_table_match_persistence
Create Date: 2026-08-17
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "0016_postal_centroid_cache"
down_revision: str | Sequence[str] | None = "0015_table_match_persistence"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create the privacy-preserving centroid cache used by Table Match."""

    op.create_table(
        "postal_code_centroids",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("country_code", sa.String(length=2), nullable=False),
        sa.Column("postal_code", sa.String(length=5), nullable=False),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column("provider", sa.String(length=32), nullable=False),
        sa.Column("accuracy", sa.Float(), nullable=False),
        sa.Column("accuracy_type", sa.String(length=32), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint(
            "country_code = 'US'",
            name="ck_postal_code_centroids_country_us",
        ),
        sa.CheckConstraint(
            "length(postal_code) = 5",
            name="ck_postal_code_centroids_postal_length",
        ),
        sa.CheckConstraint(
            "latitude BETWEEN -90 AND 90",
            name="ck_postal_code_centroids_latitude_range",
        ),
        sa.CheckConstraint(
            "longitude BETWEEN -180 AND 180",
            name="ck_postal_code_centroids_longitude_range",
        ),
        sa.CheckConstraint(
            "accuracy >= 0 AND accuracy <= 1",
            name="ck_postal_code_centroids_accuracy_range",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_postal_code_centroids"),
        sa.UniqueConstraint(
            "country_code",
            "postal_code",
            name="uq_postal_code_centroids_country_postal",
        ),
    )
    op.create_index(
        "ix_postal_code_centroids_postal_code",
        "postal_code_centroids",
        ["postal_code"],
    )
    op.execute('ALTER TABLE public."postal_code_centroids" ENABLE ROW LEVEL SECURITY')


def downgrade() -> None:
    """Remove cached ZIP centroids."""

    op.drop_index(
        "ix_postal_code_centroids_postal_code",
        table_name="postal_code_centroids",
    )
    op.drop_table("postal_code_centroids")
