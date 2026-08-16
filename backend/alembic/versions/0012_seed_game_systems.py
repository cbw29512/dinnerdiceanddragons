"""seed the initial production GameSystem catalog

Revision ID: 0012_seed_game_systems
Revises: 0011_profile_availability
Create Date: 2026-08-15
"""

from collections.abc import Sequence
from uuid import UUID

from alembic import op
import sqlalchemy as sa

revision: str = "0012_seed_game_systems"
down_revision: str | Sequence[str] | None = "0011_profile_availability"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


SYSTEM_ROWS = (
    (
        "10000000-0000-0000-0000-000000000001",
        "Dungeons & Dragons",
        "5e (2014)",
        "dnd-5e-2014",
    ),
    (
        "10000000-0000-0000-0000-000000000002",
        "Dungeons & Dragons",
        "5e (2024)",
        "dnd-5e-2024",
    ),
    ("10000000-0000-0000-0000-000000000003", "Pathfinder", "2e", "pathfinder-2e"),
    (
        "10000000-0000-0000-0000-000000000004",
        "Call of Cthulhu",
        None,
        "call-of-cthulhu",
    ),
    ("10000000-0000-0000-0000-000000000005", "Cyberpunk RED", None, "cyberpunk-red"),
    ("10000000-0000-0000-0000-000000000006", "Shadowrun", None, "shadowrun"),
    ("10000000-0000-0000-0000-000000000007", "Other RPG", None, "other-rpg"),
)


def catalog_table() -> sa.TableClause:
    """Return the minimal table shape needed by this data-only migration."""

    return sa.table(
        "game_systems",
        sa.column("id", sa.Uuid()),
        sa.column("name", sa.String()),
        sa.column("edition", sa.String()),
        sa.column("slug", sa.String()),
    )


def upgrade() -> None:
    """Insert stable reference rows matching the validated MVP selector."""

    op.bulk_insert(
        catalog_table(),
        [
            {
                "id": UUID(row_id),
                "name": name,
                "edition": edition,
                "slug": slug,
            }
            for row_id, name, edition, slug in SYSTEM_ROWS
        ],
    )


def downgrade() -> None:
    """Remove only the stable catalog rows introduced by this revision."""

    game_systems = catalog_table()
    op.execute(
        game_systems.delete().where(
            game_systems.c.id.in_([UUID(row_id) for row_id, *_ in SYSTEM_ROWS])
        )
    )
