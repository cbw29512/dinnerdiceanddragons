"""create persistent GameTable aggregate and flexible Venue host support

Revision ID: 0020_game_table_aggregate
Revises: 0019_distributed_api_rate_limits
Create Date: 2026-08-18
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "0020_game_table_aggregate"
down_revision: str | Sequence[str] | None = "0019_distributed_api_rate_limits"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add incomplete-Table persistence and non-food-centric Venue support metadata."""

    op.add_column(
        "venues",
        sa.Column(
            "host_support_offerings",
            sa.JSON(),
            server_default=sa.text("'[]'"),
            nullable=False,
        ),
    )
    op.add_column("venues", sa.Column("host_support_notes", sa.Text(), nullable=True))
    op.add_column(
        "venue_table_windows",
        sa.Column(
            "special_support_offerings",
            sa.JSON(),
            server_default=sa.text("'[]'"),
            nullable=False,
        ),
    )
    op.add_column(
        "venue_table_windows",
        sa.Column("special_support_notes", sa.Text(), nullable=True),
    )

    op.create_table(
        "game_tables",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("game_system_id", sa.Uuid(), nullable=False),
        sa.Column("created_by_user_id", sa.Uuid(), nullable=False),
        sa.Column("source_table_match_id", sa.Uuid(), nullable=True),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("lifecycle_status", sa.String(length=20), server_default="draft", nullable=False),
        sa.Column("game_format", sa.String(length=32), nullable=False),
        sa.Column("minimum_players", sa.SmallInteger(), nullable=False),
        sa.Column("maximum_players", sa.SmallInteger(), nullable=False),
        sa.Column("join_policy", sa.String(length=20), server_default="request", nullable=False),
        sa.Column("visibility", sa.String(length=16), server_default="public", nullable=False),
        sa.Column("table_style", sa.Text(), nullable=True),
        sa.Column("minimum_age", sa.SmallInteger(), nullable=True),
        sa.Column("gm_profile_id", sa.Uuid(), nullable=True),
        sa.Column("venue_id", sa.Uuid(), nullable=True),
        sa.Column("venue_table_window_id", sa.Uuid(), nullable=True),
        sa.Column("proposed_start", sa.DateTime(timezone=True), nullable=True),
        sa.Column("proposed_end", sa.DateTime(timezone=True), nullable=True),
        sa.Column("timezone", sa.String(length=64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("length(trim(title)) BETWEEN 1 AND 160", name="ck_game_tables_title_length"),
        sa.CheckConstraint(
            "lifecycle_status IN ('draft', 'forming', 'ready', 'confirmed', "
            "'in_progress', 'completed', 'cancelled', 'archived')",
            name="ck_game_tables_lifecycle_status",
        ),
        sa.CheckConstraint(
            "game_format IN ('learn_to_play', 'one_shot', 'short_campaign', "
            "'long_campaign', 'organized_play')",
            name="ck_game_tables_game_format",
        ),
        sa.CheckConstraint("join_policy IN ('open', 'request', 'invite_only')", name="ck_game_tables_join_policy"),
        sa.CheckConstraint("visibility IN ('public', 'unlisted', 'private')", name="ck_game_tables_visibility"),
        sa.CheckConstraint("minimum_players >= 1", name="ck_game_tables_minimum_players"),
        sa.CheckConstraint("maximum_players >= minimum_players", name="ck_game_tables_player_range"),
        sa.CheckConstraint("minimum_age IS NULL OR minimum_age >= 0", name="ck_game_tables_minimum_age"),
        sa.CheckConstraint(
            "(proposed_start IS NULL AND proposed_end IS NULL AND timezone IS NULL) OR "
            "(proposed_start IS NOT NULL AND proposed_end IS NOT NULL AND timezone IS NOT NULL "
            "AND proposed_end > proposed_start)",
            name="ck_game_tables_proposed_schedule",
        ),
        sa.ForeignKeyConstraint(["game_system_id"], ["game_systems.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["source_table_match_id"], ["table_matches.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["gm_profile_id"], ["gm_profiles.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["venue_id"], ["venues.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["venue_table_window_id"], ["venue_table_windows.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id", name="pk_game_tables"),
        sa.UniqueConstraint("source_table_match_id", name="uq_game_tables_source_table_match_id"),
    )
    op.create_index("ix_game_tables_game_system_id", "game_tables", ["game_system_id"])
    op.create_index("ix_game_tables_created_by_user_id", "game_tables", ["created_by_user_id"])
    op.create_index("ix_game_tables_lifecycle_status", "game_tables", ["lifecycle_status"])
    op.create_index("ix_game_tables_gm_profile_id", "game_tables", ["gm_profile_id"])
    op.create_index("ix_game_tables_venue_id", "game_tables", ["venue_id"])

    op.create_table(
        "game_table_players",
        sa.Column("game_table_id", sa.Uuid(), nullable=False),
        sa.Column("player_profile_id", sa.Uuid(), nullable=False),
        sa.Column("source_player_demand_signal_id", sa.Uuid(), nullable=True),
        sa.Column("status", sa.String(length=16), server_default="requested", nullable=False),
        sa.Column("requested_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("responded_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "status IN ('requested', 'invited', 'confirmed', 'declined', 'removed', 'left')",
            name="ck_game_table_players_status",
        ),
        sa.ForeignKeyConstraint(["game_table_id"], ["game_tables.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["player_profile_id"], ["player_profiles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["source_player_demand_signal_id"],
            ["player_demand_signals.id"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("game_table_id", "player_profile_id", name="pk_game_table_players"),
    )
    op.create_index("ix_game_table_players_player_profile_id", "game_table_players", ["player_profile_id"])
    op.create_index("ix_game_table_players_status", "game_table_players", ["status"])

    op.execute('ALTER TABLE public."game_tables" ENABLE ROW LEVEL SECURITY')
    op.execute('ALTER TABLE public."game_table_players" ENABLE ROW LEVEL SECURITY')


def downgrade() -> None:
    """Remove GameTable persistence and flexible Venue support metadata."""

    op.drop_index("ix_game_table_players_status", table_name="game_table_players")
    op.drop_index("ix_game_table_players_player_profile_id", table_name="game_table_players")
    op.drop_table("game_table_players")
    op.drop_index("ix_game_tables_venue_id", table_name="game_tables")
    op.drop_index("ix_game_tables_gm_profile_id", table_name="game_tables")
    op.drop_index("ix_game_tables_lifecycle_status", table_name="game_tables")
    op.drop_index("ix_game_tables_created_by_user_id", table_name="game_tables")
    op.drop_index("ix_game_tables_game_system_id", table_name="game_tables")
    op.drop_table("game_tables")
    op.drop_column("venue_table_windows", "special_support_notes")
    op.drop_column("venue_table_windows", "special_support_offerings")
    op.drop_column("venues", "host_support_notes")
    op.drop_column("venues", "host_support_offerings")
