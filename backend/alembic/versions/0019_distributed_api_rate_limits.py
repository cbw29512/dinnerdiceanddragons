"""create distributed authenticated API rate-limit buckets

Revision ID: 0019_distributed_api_rate_limits
Revises: 0018_game_hub_messages
Create Date: 2026-08-18
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "0019_distributed_api_rate_limits"
down_revision: str | Sequence[str] | None = "0018_game_hub_messages"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create bounded per-user/per-scope token buckets and enable RLS immediately."""

    op.create_table(
        "api_rate_limit_buckets",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("scope", sa.String(length=48), nullable=False),
        sa.Column("tokens", sa.Float(), nullable=False),
        sa.Column("last_refill_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint(
            "length(trim(scope)) BETWEEN 1 AND 48",
            name="ck_api_rate_limit_buckets_scope_length",
        ),
        sa.CheckConstraint(
            "tokens >= 0",
            name="ck_api_rate_limit_buckets_tokens_nonnegative",
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id", "scope", name="pk_api_rate_limit_buckets"),
    )
    op.create_index("ix_api_rate_limit_buckets_updated_at", "api_rate_limit_buckets", ["updated_at"])
    op.execute('ALTER TABLE public."api_rate_limit_buckets" ENABLE ROW LEVEL SECURITY')


def downgrade() -> None:
    op.drop_index("ix_api_rate_limit_buckets_updated_at", table_name="api_rate_limit_buckets")
    op.drop_table("api_rate_limit_buckets")
