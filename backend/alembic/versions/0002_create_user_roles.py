"""create multi-role user roles table

Revision ID: 0002_create_user_roles
Revises: 0001_create_users
Create Date: 2026-08-14
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "0002_create_user_roles"
down_revision: str | Sequence[str] | None = "0001_create_users"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Allow one durable DDD User to hold several application roles."""

    op.create_table(
        "user_roles",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("role", sa.String(length=32), nullable=False),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "role IN ('player', 'gm', 'venue_manager', 'moderator', 'admin')",
            name="ck_user_roles_role",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name="fk_user_roles_user_id_users",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("user_id", "role", name="pk_user_roles"),
    )


def downgrade() -> None:
    """Remove application role assignments."""

    op.drop_table("user_roles")
