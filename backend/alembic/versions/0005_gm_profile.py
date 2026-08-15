"""create GM profiles table

Revision ID: 0005_gm_profile
Revises: 0004_player_profile
Create Date: 2026-08-15
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "0005_gm_profile"
down_revision: str | Sequence[str] | None = "0004_player_profile"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create one private GM profile per durable DDD user."""

    op.create_table(
        "gm_profiles",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("bio", sa.Text(), nullable=True),
        sa.Column("postal_code", sa.String(length=5), nullable=False),
        sa.Column("travel_radius_miles", sa.Integer(), nullable=False),
        sa.Column(
            "beginner_friendly",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column("gm_style", sa.Text(), nullable=False),
        sa.CheckConstraint(
            "travel_radius_miles BETWEEN 1 AND 100",
            name="ck_gm_profiles_travel_radius_miles",
        ),
        sa.CheckConstraint(
            "length(postal_code) = 5",
            name="ck_gm_profiles_postal_code_length",
        ),
        sa.CheckConstraint(
            "length(trim(gm_style)) BETWEEN 1 AND 2000",
            name="ck_gm_profiles_gm_style_length",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name="fk_gm_profiles_user_id_users",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_gm_profiles"),
        sa.UniqueConstraint("user_id", name="uq_gm_profiles_user_id"),
    )
    op.create_index("ix_gm_profiles_user_id", "gm_profiles", ["user_id"])


def downgrade() -> None:
    """Remove GM profile persistence."""

    op.drop_index("ix_gm_profiles_user_id", table_name="gm_profiles")
    op.drop_table("gm_profiles")
