"""create Table Match demand, GM supply, and Venue table-window persistence

Revision ID: 0013_table_match_signals
Revises: 0012_seed_game_systems
Create Date: 2026-08-16
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "0013_table_match_signals"
down_revision: str | Sequence[str] | None = "0012_seed_game_systems"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create the three durable inputs to production Table Match."""

    op.create_table(
        "player_demand_signals",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("player_profile_id", sa.Uuid(), nullable=False),
        sa.Column("game_system_id", sa.Uuid(), nullable=False),
        sa.Column("preferred_format", sa.String(length=32), server_default="any", nullable=False),
        sa.Column("preferred_cadence", sa.String(length=32), nullable=True),
        sa.Column("minimum_age_preference", sa.SmallInteger(), nullable=True),
        sa.Column("table_style_preferences", sa.JSON(), server_default=sa.text("'[]'"), nullable=False),
        sa.Column("environment_preferences", sa.JSON(), server_default=sa.text("'[]'"), nullable=False),
        sa.Column("status", sa.String(length=16), server_default="active", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint(
            "preferred_format IN ('any', 'learn_to_play', 'one_shot', 'short_campaign', "
            "'long_campaign', 'organized_play')",
            name="ck_player_demand_signals_preferred_format",
        ),
        sa.CheckConstraint(
            "status IN ('active', 'paused', 'matched', 'expired')",
            name="ck_player_demand_signals_status",
        ),
        sa.CheckConstraint(
            "minimum_age_preference IS NULL OR minimum_age_preference >= 0",
            name="ck_player_demand_signals_minimum_age",
        ),
        sa.ForeignKeyConstraint(
            ["player_profile_id"],
            ["player_profiles.id"],
            name="fk_player_demand_profile",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["game_system_id"],
            ["game_systems.id"],
            name="fk_player_demand_system",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_player_demand_signals"),
    )
    op.create_index(
        "ix_player_demand_signals_player_profile_id",
        "player_demand_signals",
        ["player_profile_id"],
        unique=False,
    )
    op.create_index(
        "ix_player_demand_signals_game_system_id",
        "player_demand_signals",
        ["game_system_id"],
        unique=False,
    )
    op.create_index(
        "ix_player_demand_signals_status",
        "player_demand_signals",
        ["status"],
        unique=False,
    )

    op.create_table(
        "gm_supply_signals",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("gm_profile_id", sa.Uuid(), nullable=False),
        sa.Column("game_system_id", sa.Uuid(), nullable=False),
        sa.Column("preferred_format", sa.String(length=32), server_default="one_shot", nullable=False),
        sa.Column("preferred_cadence", sa.String(length=32), nullable=True),
        sa.Column("minimum_players", sa.SmallInteger(), nullable=False),
        sa.Column("maximum_players", sa.SmallInteger(), nullable=False),
        sa.Column("table_style", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=16), server_default="active", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint(
            "preferred_format IN ('learn_to_play', 'one_shot', 'short_campaign', "
            "'long_campaign', 'organized_play')",
            name="ck_gm_supply_signals_preferred_format",
        ),
        sa.CheckConstraint(
            "status IN ('active', 'paused', 'matched', 'expired')",
            name="ck_gm_supply_signals_status",
        ),
        sa.CheckConstraint(
            "minimum_players >= 1",
            name="ck_gm_supply_signals_minimum_players",
        ),
        sa.CheckConstraint(
            "maximum_players >= minimum_players",
            name="ck_gm_supply_signals_player_range",
        ),
        sa.ForeignKeyConstraint(
            ["gm_profile_id"],
            ["gm_profiles.id"],
            name="fk_gm_supply_profile",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["game_system_id"],
            ["game_systems.id"],
            name="fk_gm_supply_system",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_gm_supply_signals"),
    )
    op.create_index(
        "ix_gm_supply_signals_gm_profile_id",
        "gm_supply_signals",
        ["gm_profile_id"],
        unique=False,
    )
    op.create_index(
        "ix_gm_supply_signals_game_system_id",
        "gm_supply_signals",
        ["game_system_id"],
        unique=False,
    )
    op.create_index(
        "ix_gm_supply_signals_status",
        "gm_supply_signals",
        ["status"],
        unique=False,
    )

    op.create_table(
        "venue_table_windows",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("venue_id", sa.Uuid(), nullable=False),
        sa.Column("recurring_rule_id", sa.Uuid(), nullable=False),
        sa.Column("table_count", sa.SmallInteger(), nullable=False),
        sa.Column("max_people_per_table", sa.SmallInteger(), nullable=False),
        sa.Column("purchase_policy", sa.Text(), nullable=True),
        sa.Column("approval_required", sa.Boolean(), nullable=False),
        sa.Column("environment_notes", sa.Text(), nullable=True),
        sa.Column("active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.CheckConstraint(
            "table_count >= 1",
            name="ck_venue_table_windows_table_count",
        ),
        sa.CheckConstraint(
            "max_people_per_table >= 1",
            name="ck_venue_table_windows_max_people",
        ),
        sa.ForeignKeyConstraint(
            ["venue_id"],
            ["venues.id"],
            name="fk_venue_window_venue",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["recurring_rule_id"],
            ["recurring_availability_rules.id"],
            name="fk_venue_window_rule",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_venue_table_windows"),
        sa.UniqueConstraint(
            "recurring_rule_id",
            name="uq_venue_table_windows_recurring_rule_id",
        ),
    )
    op.create_index(
        "ix_venue_table_windows_venue_id",
        "venue_table_windows",
        ["venue_id"],
        unique=False,
    )
    op.create_index(
        "ix_venue_table_windows_active",
        "venue_table_windows",
        ["active"],
        unique=False,
    )


def downgrade() -> None:
    """Remove the first production Table Match persistence slice."""

    op.drop_index("ix_venue_table_windows_active", table_name="venue_table_windows")
    op.drop_index("ix_venue_table_windows_venue_id", table_name="venue_table_windows")
    op.drop_table("venue_table_windows")

    op.drop_index("ix_gm_supply_signals_status", table_name="gm_supply_signals")
    op.drop_index("ix_gm_supply_signals_game_system_id", table_name="gm_supply_signals")
    op.drop_index("ix_gm_supply_signals_gm_profile_id", table_name="gm_supply_signals")
    op.drop_table("gm_supply_signals")

    op.drop_index("ix_player_demand_signals_status", table_name="player_demand_signals")
    op.drop_index("ix_player_demand_signals_game_system_id", table_name="player_demand_signals")
    op.drop_index("ix_player_demand_signals_player_profile_id", table_name="player_demand_signals")
    op.drop_table("player_demand_signals")
