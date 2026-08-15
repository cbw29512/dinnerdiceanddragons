"""create player profiles table

Revision ID: 0004_player_profile
Revises: 0003_priv_audit
Create Date: 2026-08-15
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "0004_player_profile"
down_revision: str | Sequence[str] | None = "0003_priv_audit"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create one private Player profile per durable DDD user."""

    op.create_table(
        "player_profiles",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("bio", sa.Text(), nullable=True),
        sa.Column("postal_code", sa.String(length=5), nullable=False),
        sa.Column("travel_radius_miles", sa.Integer(), nullable=False),
        sa.Column(
            "preferred_format",
            sa.String(length=32),
            nullable=False,
            server_default="any",
        ),
        sa.Column(
            "willing_to_learn_new_system",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.Column(
            "environment_preferences",
            sa.JSON(),
            nullable=False,
            server_default=sa.text("'[]'"),
        ),
        sa.Column("accessibility_notes_private", sa.Text(), nullable=True),
        sa.CheckConstraint(
            "travel_radius_miles BETWEEN 1 AND 100",
            name="ck_player_profiles_travel_radius_miles",
        ),
        sa.CheckConstraint(
            "length(postal_code) = 5",
            name="ck_player_profiles_postal_code_length",
        ),
        sa.CheckConstraint(
            "preferred_format IN "
            "('any', 'learn_to_play', 'one_shot', 'short_campaign', "
            "'long_campaign', 'organized_play')",
            name="ck_player_profiles_preferred_format",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name="fk_player_profiles_user_id_users",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_player_profiles"),
        sa.UniqueConstraint("user_id", name="uq_player_profiles_user_id"),
    )
    op.create_index(
        "ix_player_profiles_user_id",
        "player_profiles",
        ["user_id"],
    )


def downgrade() -> None:
    """Remove Player profile persistence."""

    op.drop_index("ix_player_profiles_user_id", table_name="player_profiles")
    op.drop_table("player_profiles")
