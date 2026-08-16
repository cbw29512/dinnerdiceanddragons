"""create canonical game system catalog

Revision ID: 0007_game_system
Revises: 0006_venue_manager
Create Date: 2026-08-15
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "0007_game_system"
down_revision: str | Sequence[str] | None = "0006_venue_manager"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create canonical RPG system/edition records."""

    op.create_table(
        "game_systems",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("edition", sa.String(length=80), nullable=True),
        sa.Column("slug", sa.String(length=160), nullable=False),
        sa.Column("publisher_name", sa.String(length=160), nullable=True),
        sa.Column(
            "active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.CheckConstraint(
            "length(trim(name)) BETWEEN 1 AND 120",
            name="ck_game_systems_name_length",
        ),
        sa.CheckConstraint(
            "edition IS NULL OR length(trim(edition)) BETWEEN 1 AND 80",
            name="ck_game_systems_edition_length",
        ),
        sa.CheckConstraint(
            "length(trim(slug)) BETWEEN 1 AND 160",
            name="ck_game_systems_slug_length",
        ),
        sa.CheckConstraint(
            "slug = lower(slug)",
            name="ck_game_systems_slug_lowercase",
        ),
        sa.CheckConstraint(
            "publisher_name IS NULL OR length(trim(publisher_name)) BETWEEN 1 AND 160",
            name="ck_game_systems_publisher_name_length",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_game_systems"),
        sa.UniqueConstraint("slug", name="uq_game_systems_slug"),
    )


def downgrade() -> None:
    """Remove canonical GameSystem records."""

    op.drop_table("game_systems")
