"""create GM system experience and multi-format persistence

Revision ID: 0009_gm_system_experience
Revises: 0008_player_system_experience
Create Date: 2026-08-15
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "0009_gm_system_experience"
down_revision: str | Sequence[str] | None = "0008_player_system_experience"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create GM per-system experience and supported-format rows."""

    op.create_table(
        "gm_system_experiences",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("gm_profile_id", sa.Uuid(), nullable=False),
        sa.Column("game_system_id", sa.Uuid(), nullable=False),
        sa.Column("years_playing", sa.Numeric(precision=4, scale=1), nullable=False),
        sa.Column("years_gming", sa.Numeric(precision=4, scale=1), nullable=False),
        sa.Column("comfort_level", sa.String(length=32), nullable=False),
        sa.Column("preferred_player_experience", sa.String(length=32), nullable=False),
        sa.Column("experience_notes", sa.Text(), nullable=True),
        sa.CheckConstraint(
            "years_playing BETWEEN 0 AND 80",
            name="ck_gm_system_experiences_years_playing",
        ),
        sa.CheckConstraint(
            "years_gming BETWEEN 0 AND 80",
            name="ck_gm_system_experiences_years_gming",
        ),
        sa.CheckConstraint(
            "comfort_level IN ('learning', 'comfortable', 'very_comfortable', 'expert')",
            name="ck_gm_system_experiences_comfort_level",
        ),
        sa.CheckConstraint(
            "preferred_player_experience IN ('any', 'new_players', 'some_experience', 'experienced')",
            name="ck_gm_system_experiences_preferred_player_experience",
        ),
        sa.CheckConstraint(
            "experience_notes IS NULL OR length(trim(experience_notes)) BETWEEN 1 AND 2000",
            name="ck_gm_system_experiences_notes_length",
        ),
        sa.ForeignKeyConstraint(
            ["game_system_id"],
            ["game_systems.id"],
            name="fk_gm_system_experiences_game_system_id_game_systems",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["gm_profile_id"],
            ["gm_profiles.id"],
            name="fk_gm_system_experiences_gm_profile_id_gm_profiles",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_gm_system_experiences"),
        sa.UniqueConstraint(
            "gm_profile_id",
            "game_system_id",
            name="uq_gm_system_experiences_profile_system",
        ),
    )
    op.create_index(
        "ix_gm_system_experiences_gm_profile_id",
        "gm_system_experiences",
        ["gm_profile_id"],
        unique=False,
    )
    op.create_index(
        "ix_gm_system_experiences_game_system_id",
        "gm_system_experiences",
        ["game_system_id"],
        unique=False,
    )

    op.create_table(
        "gm_system_formats",
        sa.Column("gm_system_experience_id", sa.Uuid(), nullable=False),
        sa.Column("format", sa.String(length=32), nullable=False),
        sa.CheckConstraint(
            "format IN ('learn_to_play', 'one_shot', 'short_campaign', 'long_campaign', 'organized_play')",
            name="ck_gm_system_formats_format",
        ),
        sa.ForeignKeyConstraint(
            ["gm_system_experience_id"],
            ["gm_system_experiences.id"],
            name="fk_gm_system_formats_experience_id",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint(
            "gm_system_experience_id",
            "format",
            name="pk_gm_system_formats",
        ),
    )


def downgrade() -> None:
    """Remove GM system experience and supported formats."""

    op.drop_table("gm_system_formats")
    op.drop_index(
        "ix_gm_system_experiences_game_system_id",
        table_name="gm_system_experiences",
    )
    op.drop_index(
        "ix_gm_system_experiences_gm_profile_id",
        table_name="gm_system_experiences",
    )
    op.drop_table("gm_system_experiences")
