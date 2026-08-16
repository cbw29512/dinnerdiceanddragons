"""create player system experience persistence

Revision ID: 0008_player_system_experience
Revises: 0007_game_system
Create Date: 2026-08-15
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "0008_player_system_experience"
down_revision: str | Sequence[str] | None = "0007_game_system"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create Player-to-GameSystem self-described experience rows."""

    op.create_table(
        "player_system_experiences",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("player_profile_id", sa.Uuid(), nullable=False),
        sa.Column("game_system_id", sa.Uuid(), nullable=False),
        sa.Column("years_playing", sa.Numeric(precision=4, scale=1), nullable=False),
        sa.Column("comfort_level", sa.String(length=32), nullable=False),
        sa.Column("experience_notes", sa.Text(), nullable=True),
        sa.CheckConstraint(
            "years_playing BETWEEN 0 AND 80",
            name="ck_player_system_experiences_years_playing",
        ),
        sa.CheckConstraint(
            "comfort_level IN ('new', 'learning', 'comfortable', 'very_experienced')",
            name="ck_player_system_experiences_comfort_level",
        ),
        sa.CheckConstraint(
            "experience_notes IS NULL OR length(trim(experience_notes)) BETWEEN 1 AND 2000",
            name="ck_player_system_experiences_notes_length",
        ),
        sa.ForeignKeyConstraint(
            ["game_system_id"],
            ["game_systems.id"],
            name="fk_player_system_experiences_game_system_id_game_systems",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["player_profile_id"],
            ["player_profiles.id"],
            name="fk_player_system_experiences_player_profile_id_player_profiles",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_player_system_experiences"),
        sa.UniqueConstraint(
            "player_profile_id",
            "game_system_id",
            name="uq_player_system_experiences_profile_system",
        ),
    )
    op.create_index(
        "ix_player_system_experiences_player_profile_id",
        "player_system_experiences",
        ["player_profile_id"],
        unique=False,
    )
    op.create_index(
        "ix_player_system_experiences_game_system_id",
        "player_system_experiences",
        ["game_system_id"],
        unique=False,
    )


def downgrade() -> None:
    """Remove PlayerSystemExperience persistence."""

    op.drop_index(
        "ix_player_system_experiences_game_system_id",
        table_name="player_system_experiences",
    )
    op.drop_index(
        "ix_player_system_experiences_player_profile_id",
        table_name="player_system_experiences",
    )
    op.drop_table("player_system_experiences")
