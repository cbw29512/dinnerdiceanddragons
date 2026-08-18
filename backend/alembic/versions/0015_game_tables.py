"""create persistent Dinner, Dice & Dragons Tables

Revision ID: 0015_game_tables
Revises: 0014_supabase_rls_hardening
Create Date: 2026-08-18
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "0015_game_tables"
down_revision: str | Sequence[str] | None = "0014_supabase_rls_hardening"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create the central persistent Table aggregate and deny direct PostgREST access."""

    op.create_table(
        "game_tables",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("game_system_id", sa.Uuid(), nullable=False),
        sa.Column("created_by_user_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("lifecycle_status", sa.String(length=20), server_default="draft", nullable=False),
        sa.Column("game_format", sa.String(length=32), server_default="one_shot", nullable=False),
        sa.Column("minimum_players", sa.SmallInteger(), nullable=False),
        sa.Column("maximum_players", sa.SmallInteger(), nullable=False),
        sa.Column("join_policy", sa.String(length=20), server_default="request", nullable=False),
        sa.Column("visibility", sa.String(length=16), server_default="public", nullable=False),
        sa.Column("table_style", sa.Text(), nullable=True),
        sa.Column("minimum_age", sa.SmallInteger(), nullable=True),
        sa.Column("gm_profile_id", sa.Uuid(), nullable=True),
        sa.Column("venue_id", sa.Uuid(), nullable=True),
        sa.Column("venue_table_window_id", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint(
            "length(trim(title)) BETWEEN 1 AND 160",
            name="ck_game_tables_title_length",
        ),
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
        sa.CheckConstraint(
            "join_policy IN ('open', 'request', 'invite_only')",
            name="ck_game_tables_join_policy",
        ),
        sa.CheckConstraint(
            "visibility IN ('public', 'unlisted', 'private')",
            name="ck_game_tables_visibility",
        ),
        sa.CheckConstraint("minimum_players >= 1", name="ck_game_tables_minimum_players"),
        sa.CheckConstraint(
            "maximum_players >= minimum_players",
            name="ck_game_tables_player_range",
        ),
        sa.CheckConstraint(
            "minimum_age IS NULL OR minimum_age >= 0",
            name="ck_game_tables_minimum_age",
        ),
        sa.ForeignKeyConstraint(
            ["game_system_id"],
            ["game_systems.id"],
            name="fk_game_tables_game_system",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["created_by_user_id"],
            ["users.id"],
            name="fk_game_tables_created_by_user",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["gm_profile_id"],
            ["gm_profiles.id"],
            name="fk_game_tables_gm_profile",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["venue_id"],
            ["venues.id"],
            name="fk_game_tables_venue",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["venue_table_window_id"],
            ["venue_table_windows.id"],
            name="fk_game_tables_venue_window",
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_game_tables"),
    )
    op.create_index("ix_game_tables_game_system_id", "game_tables", ["game_system_id"], unique=False)
    op.create_index("ix_game_tables_created_by_user_id", "game_tables", ["created_by_user_id"], unique=False)
    op.create_index("ix_game_tables_lifecycle_status", "game_tables", ["lifecycle_status"], unique=False)
    op.create_index("ix_game_tables_gm_profile_id", "game_tables", ["gm_profile_id"], unique=False)
    op.create_index("ix_game_tables_venue_id", "game_tables", ["venue_id"], unique=False)

    # Match the existing Supabase hardening posture: application-server access
    # remains authoritative while direct PostgREST access has no permissive policy.
    op.execute('ALTER TABLE public."game_tables" ENABLE ROW LEVEL SECURITY')


def downgrade() -> None:
    """Remove the first persistent Table aggregate."""

    op.execute('ALTER TABLE public."game_tables" DISABLE ROW LEVEL SECURITY')
    op.drop_index("ix_game_tables_venue_id", table_name="game_tables")
    op.drop_index("ix_game_tables_gm_profile_id", table_name="game_tables")
    op.drop_index("ix_game_tables_lifecycle_status", table_name="game_tables")
    op.drop_index("ix_game_tables_created_by_user_id", table_name="game_tables")
    op.drop_index("ix_game_tables_game_system_id", table_name="game_tables")
    op.drop_table("game_tables")
