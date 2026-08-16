"""create Player and GM availability window persistence

Revision ID: 0011_profile_availability_windows
Revises: 0010_recurring_availability_rule
Create Date: 2026-08-15
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "0011_profile_availability_windows"
down_revision: str | Sequence[str] | None = "0010_recurring_availability_rule"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create typed Player and GM references to recurring schedule rules."""

    op.create_table(
        "player_availability_windows",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("player_profile_id", sa.Uuid(), nullable=False),
        sa.Column("recurring_rule_id", sa.Uuid(), nullable=False),
        sa.Column("active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.ForeignKeyConstraint(
            ["player_profile_id"],
            ["player_profiles.id"],
            name="fk_player_avail_profile",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["recurring_rule_id"],
            ["recurring_availability_rules.id"],
            name="fk_player_avail_rule",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_player_availability_windows"),
        sa.UniqueConstraint(
            "recurring_rule_id",
            name="uq_player_availability_windows_recurring_rule_id",
        ),
    )
    op.create_index(
        "ix_player_availability_windows_player_profile_id",
        "player_availability_windows",
        ["player_profile_id"],
        unique=False,
    )

    op.create_table(
        "gm_availability_windows",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("gm_profile_id", sa.Uuid(), nullable=False),
        sa.Column("recurring_rule_id", sa.Uuid(), nullable=False),
        sa.Column("active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.ForeignKeyConstraint(
            ["gm_profile_id"],
            ["gm_profiles.id"],
            name="fk_gm_avail_profile",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["recurring_rule_id"],
            ["recurring_availability_rules.id"],
            name="fk_gm_avail_rule",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_gm_availability_windows"),
        sa.UniqueConstraint(
            "recurring_rule_id",
            name="uq_gm_availability_windows_recurring_rule_id",
        ),
    )
    op.create_index(
        "ix_gm_availability_windows_gm_profile_id",
        "gm_availability_windows",
        ["gm_profile_id"],
        unique=False,
    )


def downgrade() -> None:
    """Remove typed profile availability windows."""

    op.drop_index(
        "ix_gm_availability_windows_gm_profile_id",
        table_name="gm_availability_windows",
    )
    op.drop_table("gm_availability_windows")
    op.drop_index(
        "ix_player_availability_windows_player_profile_id",
        table_name="player_availability_windows",
    )
    op.drop_table("player_availability_windows")
