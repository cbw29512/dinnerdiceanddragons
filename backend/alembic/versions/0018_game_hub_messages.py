"""create persistent Game Hub messages

Revision ID: 0018_game_hub_messages
Revises: 0017_table_formation_lifecycle
Create Date: 2026-08-18
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "0018_game_hub_messages"
down_revision: str | Sequence[str] | None = "0017_table_formation_lifecycle"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "messages",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("event_id", sa.Uuid(), nullable=False),
        sa.Column("sender_user_id", sa.Uuid(), nullable=False),
        sa.Column("channel_type", sa.String(length=32), nullable=False),
        sa.Column("recipient_user_id", sa.Uuid(), nullable=True),
        sa.Column("venue_id", sa.Uuid(), nullable=True),
        sa.Column("category", sa.String(length=32), nullable=True),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("moderation_status", sa.String(length=16), server_default="visible", nullable=False),
        sa.CheckConstraint("channel_type IN ('table_announcement','table_discussion','gm_venue','player_gm','player_venue_question','system_notification')", name="ck_messages_channel_type"),
        sa.CheckConstraint("moderation_status IN ('visible','flagged','hidden','removed')", name="ck_messages_moderation_status"),
        sa.CheckConstraint("length(trim(body)) BETWEEN 1 AND 4000", name="ck_messages_body_length"),
        sa.CheckConstraint("category IS NULL OR category IN ('accessibility','food_allergies','parking','seating','venue_policy','other')", name="ck_messages_category"),
        sa.CheckConstraint("channel_type <> 'player_venue_question' OR (venue_id IS NOT NULL AND category IS NOT NULL)", name="ck_messages_player_venue_fields"),
        sa.CheckConstraint("channel_type <> 'gm_venue' OR venue_id IS NOT NULL", name="ck_messages_gm_venue_fields"),
        sa.CheckConstraint("channel_type <> 'player_gm' OR recipient_user_id IS NOT NULL", name="ck_messages_player_gm_fields"),
        sa.ForeignKeyConstraint(["event_id"], ["events.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["sender_user_id"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["recipient_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["venue_id"], ["venues.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id", name="pk_messages"),
    )
    for column in ("event_id", "sender_user_id", "channel_type", "recipient_user_id", "venue_id", "created_at", "moderation_status"):
        op.create_index(f"ix_messages_{column}", "messages", [column])
    op.create_index("ix_messages_event_channel_created", "messages", ["event_id", "channel_type", "created_at"])
    op.execute('ALTER TABLE public."messages" ENABLE ROW LEVEL SECURITY')


def downgrade() -> None:
    op.drop_index("ix_messages_event_channel_created", table_name="messages")
    for column in reversed(("event_id", "sender_user_id", "channel_type", "recipient_user_id", "venue_id", "created_at", "moderation_status")):
        op.drop_index(f"ix_messages_{column}", table_name="messages")
    op.drop_table("messages")
