"""link scheduled Events to persistent GameTables

Revision ID: 0021_event_game_table_link
Revises: 0020_game_table_aggregate
Create Date: 2026-08-18
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "0021_event_game_table_link"
down_revision: str | Sequence[str] | None = "0020_game_table_aggregate"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Attach existing Event occurrences to the persistent Table aggregate."""

    op.add_column("events", sa.Column("game_table_id", sa.Uuid(), nullable=True))
    op.create_foreign_key(
        "fk_events_game_table_id",
        "events",
        "game_tables",
        ["game_table_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_events_game_table_id", "events", ["game_table_id"])


def downgrade() -> None:
    """Remove the optional Event-to-GameTable relationship."""

    op.drop_index("ix_events_game_table_id", table_name="events")
    op.drop_constraint("fk_events_game_table_id", "events", type_="foreignkey")
    op.drop_column("events", "game_table_id")
