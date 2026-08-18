"""create distributed API rate-limit buckets

Revision ID: 0019_api_rate_limit_buckets
Revises: 0018_game_hub_messages
Create Date: 2026-08-18
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "0019_api_rate_limit_buckets"
down_revision: str | Sequence[str] | None = "0018_game_hub_messages"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create privacy-preserving shared limiter state for every API instance."""

    op.create_table(
        "api_rate_limit_buckets",
        sa.Column("policy", sa.String(length=64), nullable=False),
        sa.Column("subject_hash", sa.String(length=64), nullable=False),
        sa.Column("window_started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("request_count", sa.Integer(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("request_count BETWEEN 1 AND 1000000", name="ck_api_rate_limit_count"),
        sa.PrimaryKeyConstraint("policy", "subject_hash", name="pk_api_rate_limit_buckets"),
    )
    op.create_index(
        "ix_api_rate_limit_buckets_expires_at",
        "api_rate_limit_buckets",
        ["expires_at"],
    )
    op.execute('ALTER TABLE public."api_rate_limit_buckets" ENABLE ROW LEVEL SECURITY')


def downgrade() -> None:
    """Remove the operational limiter state table."""

    op.drop_index("ix_api_rate_limit_buckets_expires_at", table_name="api_rate_limit_buckets")
    op.drop_table("api_rate_limit_buckets")
