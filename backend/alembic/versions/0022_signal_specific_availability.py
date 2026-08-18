"""add signal-specific matching availability

Revision ID: 0022_signal_specific_availability
Revises: 0021_event_game_table_link
Create Date: 2026-08-18
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "0022_signal_specific_availability"
down_revision: str | Sequence[str] | None = "0021_event_game_table_link"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Give each concrete demand/supply signal its own recurring time windows."""

    op.create_table(
        "player_demand_availability_windows",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("player_demand_signal_id", sa.Uuid(), nullable=False),
        sa.Column("recurring_rule_id", sa.Uuid(), nullable=False),
        sa.Column("active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.ForeignKeyConstraint(
            ["player_demand_signal_id"],
            ["player_demand_signals.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["recurring_rule_id"],
            ["recurring_availability_rules.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "recurring_rule_id",
            name="uq_player_demand_availability_windows_rule_id",
        ),
    )
    op.create_index(
        "ix_player_demand_availability_windows_player_demand_signal_id",
        "player_demand_availability_windows",
        ["player_demand_signal_id"],
    )
    op.create_index(
        "ix_player_demand_availability_windows_active",
        "player_demand_availability_windows",
        ["active"],
    )
    op.execute(
        'ALTER TABLE public."player_demand_availability_windows" ENABLE ROW LEVEL SECURITY'
    )

    op.create_table(
        "gm_supply_availability_windows",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("gm_supply_signal_id", sa.Uuid(), nullable=False),
        sa.Column("recurring_rule_id", sa.Uuid(), nullable=False),
        sa.Column("active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.ForeignKeyConstraint(
            ["gm_supply_signal_id"],
            ["gm_supply_signals.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["recurring_rule_id"],
            ["recurring_availability_rules.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "recurring_rule_id",
            name="uq_gm_supply_availability_windows_rule_id",
        ),
    )
    op.create_index(
        "ix_gm_supply_availability_windows_gm_supply_signal_id",
        "gm_supply_availability_windows",
        ["gm_supply_signal_id"],
    )
    op.create_index(
        "ix_gm_supply_availability_windows_active",
        "gm_supply_availability_windows",
        ["active"],
    )
    op.execute('ALTER TABLE public."gm_supply_availability_windows" ENABLE ROW LEVEL SECURITY')


def downgrade() -> None:
    """Remove signal-specific time-window ownership."""

    op.drop_index(
        "ix_gm_supply_availability_windows_active",
        table_name="gm_supply_availability_windows",
    )
    op.drop_index(
        "ix_gm_supply_availability_windows_gm_supply_signal_id",
        table_name="gm_supply_availability_windows",
    )
    op.drop_table("gm_supply_availability_windows")

    op.drop_index(
        "ix_player_demand_availability_windows_active",
        table_name="player_demand_availability_windows",
    )
    op.drop_index(
        "ix_player_demand_availability_windows_player_demand_signal_id",
        table_name="player_demand_availability_windows",
    )
    op.drop_table("player_demand_availability_windows")
