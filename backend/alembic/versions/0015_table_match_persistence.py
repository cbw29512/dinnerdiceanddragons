"""create persisted Table Match opportunities and explanations

Revision ID: 0015_table_match_persistence
Revises: 0014_supabase_rls_hardening
Create Date: 2026-08-17
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "0015_table_match_persistence"
down_revision: str | Sequence[str] | None = "0014_supabase_rls_hardening"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create deterministic, explainable Table Match persistence."""

    op.create_table(
        "table_matches",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("gm_supply_signal_id", sa.Uuid(), nullable=False),
        sa.Column("venue_table_window_id", sa.Uuid(), nullable=False),
        sa.Column("game_system_id", sa.Uuid(), nullable=False),
        sa.Column("proposed_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("proposed_end", sa.DateTime(timezone=True), nullable=False),
        sa.Column("timezone", sa.String(length=64), nullable=False),
        sa.Column("minimum_players", sa.SmallInteger(), nullable=False),
        sa.Column("maximum_players", sa.SmallInteger(), nullable=False),
        sa.Column("compatible_player_count", sa.SmallInteger(), server_default="0", nullable=False),
        sa.Column("distance_summary", sa.JSON(), server_default=sa.text("'{}'"), nullable=False),
        sa.Column("fit_score", sa.Numeric(precision=5, scale=2), server_default="0", nullable=False),
        sa.Column("status", sa.String(length=16), server_default="potential", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint(
            "status IN ('potential', 'invited', 'forming', 'rejected', 'expired', 'converted')",
            name="ck_table_matches_status",
        ),
        sa.CheckConstraint("proposed_end > proposed_start", name="ck_table_matches_time_order"),
        sa.CheckConstraint("minimum_players >= 1", name="ck_table_matches_minimum_players"),
        sa.CheckConstraint(
            "maximum_players >= minimum_players",
            name="ck_table_matches_player_range",
        ),
        sa.CheckConstraint(
            "compatible_player_count >= 0",
            name="ck_table_matches_compatible_player_count",
        ),
        sa.CheckConstraint(
            "fit_score >= 0 AND fit_score <= 100",
            name="ck_table_matches_fit_score",
        ),
        sa.CheckConstraint(
            "length(timezone) >= 1 AND length(timezone) <= 64",
            name="ck_table_matches_timezone_length",
        ),
        sa.ForeignKeyConstraint(
            ["gm_supply_signal_id"],
            ["gm_supply_signals.id"],
            name="fk_table_matches_gm_supply_signal",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["venue_table_window_id"],
            ["venue_table_windows.id"],
            name="fk_table_matches_venue_table_window",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["game_system_id"],
            ["game_systems.id"],
            name="fk_table_matches_game_system",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_table_matches"),
        sa.UniqueConstraint(
            "gm_supply_signal_id",
            "venue_table_window_id",
            "proposed_start",
            "proposed_end",
            name="uq_table_matches_gm_venue_occurrence",
        ),
    )
    op.create_index("ix_table_matches_gm_supply_signal_id", "table_matches", ["gm_supply_signal_id"])
    op.create_index("ix_table_matches_venue_table_window_id", "table_matches", ["venue_table_window_id"])
    op.create_index("ix_table_matches_game_system_id", "table_matches", ["game_system_id"])
    op.create_index("ix_table_matches_proposed_start", "table_matches", ["proposed_start"])
    op.create_index("ix_table_matches_status", "table_matches", ["status"])

    op.create_table(
        "table_match_players",
        sa.Column("table_match_id", sa.Uuid(), nullable=False),
        sa.Column("player_demand_signal_id", sa.Uuid(), nullable=False),
        sa.Column("fit_flags", sa.JSON(), server_default=sa.text("'[]'"), nullable=False),
        sa.Column("distance_miles", sa.Numeric(precision=8, scale=2), nullable=False),
        sa.Column("availability_overlap", sa.JSON(), server_default=sa.text("'{}'"), nullable=False),
        sa.Column("status", sa.String(length=16), server_default="eligible", nullable=False),
        sa.CheckConstraint(
            "status IN ('eligible', 'notified', 'interested', 'declined', 'committed')",
            name="ck_table_match_players_status",
        ),
        sa.CheckConstraint(
            "distance_miles >= 0",
            name="ck_table_match_players_distance_miles",
        ),
        sa.ForeignKeyConstraint(
            ["table_match_id"],
            ["table_matches.id"],
            name="fk_table_match_players_match",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["player_demand_signal_id"],
            ["player_demand_signals.id"],
            name="fk_table_match_players_player_demand",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint(
            "table_match_id",
            "player_demand_signal_id",
            name="pk_table_match_players",
        ),
    )
    op.create_index(
        "ix_table_match_players_player_demand_signal_id",
        "table_match_players",
        ["player_demand_signal_id"],
    )
    op.create_index("ix_table_match_players_status", "table_match_players", ["status"])

    op.create_table(
        "match_explanations",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("table_match_id", sa.Uuid(), nullable=False),
        sa.Column("criterion", sa.String(length=32), nullable=False),
        sa.Column("result", sa.String(length=16), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("weight", sa.Numeric(precision=8, scale=4), nullable=True),
        sa.CheckConstraint(
            "result IN ('pass', 'fail', 'info')",
            name="ck_match_explanations_result",
        ),
        sa.CheckConstraint(
            "length(trim(criterion)) >= 1",
            name="ck_match_explanations_criterion_nonblank",
        ),
        sa.CheckConstraint(
            "length(trim(summary)) >= 1",
            name="ck_match_explanations_summary_nonblank",
        ),
        sa.ForeignKeyConstraint(
            ["table_match_id"],
            ["table_matches.id"],
            name="fk_match_explanations_match",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_match_explanations"),
        sa.UniqueConstraint(
            "table_match_id",
            "criterion",
            name="uq_match_explanations_match_criterion",
        ),
    )
    op.create_index("ix_match_explanations_table_match_id", "match_explanations", ["table_match_id"])

    for table_name in ("table_matches", "table_match_players", "match_explanations"):
        op.execute(f'ALTER TABLE public."{table_name}" ENABLE ROW LEVEL SECURITY')


def downgrade() -> None:
    """Remove persisted Table Match opportunities and their child records."""

    op.drop_index("ix_match_explanations_table_match_id", table_name="match_explanations")
    op.drop_table("match_explanations")

    op.drop_index("ix_table_match_players_status", table_name="table_match_players")
    op.drop_index(
        "ix_table_match_players_player_demand_signal_id",
        table_name="table_match_players",
    )
    op.drop_table("table_match_players")

    op.drop_index("ix_table_matches_status", table_name="table_matches")
    op.drop_index("ix_table_matches_proposed_start", table_name="table_matches")
    op.drop_index("ix_table_matches_game_system_id", table_name="table_matches")
    op.drop_index("ix_table_matches_venue_table_window_id", table_name="table_matches")
    op.drop_index("ix_table_matches_gm_supply_signal_id", table_name="table_matches")
    op.drop_table("table_matches")
