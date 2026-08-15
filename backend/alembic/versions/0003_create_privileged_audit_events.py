"""create privileged audit events table

Revision ID: 0003_create_privileged_audit_events
Revises: 0002_create_user_roles
Create Date: 2026-08-15
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "0003_create_privileged_audit_events"
down_revision: str | Sequence[str] | None = "0002_create_user_roles"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create durable, append-only privileged action evidence."""

    op.create_table(
        "privileged_audit_events",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("actor_user_id", sa.Uuid(), nullable=False),
        sa.Column("actor_role", sa.String(length=32), nullable=False),
        sa.Column("action", sa.String(length=120), nullable=False),
        sa.Column("target_type", sa.String(length=80), nullable=False),
        sa.Column("target_id", sa.String(length=255), nullable=True),
        sa.Column("outcome", sa.String(length=16), nullable=False),
        sa.Column("reason_code", sa.String(length=80), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint(
            "actor_role IN ('moderator', 'admin')",
            name="ck_privileged_audit_events_actor_role",
        ),
        sa.CheckConstraint(
            "outcome IN ('success', 'denied', 'error')",
            name="ck_privileged_audit_events_outcome",
        ),
        sa.ForeignKeyConstraint(
            ["actor_user_id"],
            ["users.id"],
            name="fk_privileged_audit_events_actor_user_id_users",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_privileged_audit_events"),
    )
    op.create_index(
        "ix_privileged_audit_events_actor_user_id",
        "privileged_audit_events",
        ["actor_user_id"],
    )
    op.execute(
        """
        CREATE FUNCTION deny_privileged_audit_event_mutation()
        RETURNS trigger AS $$
        BEGIN
            RAISE EXCEPTION 'privileged audit events are append-only';
        END;
        $$ LANGUAGE plpgsql;
        """
    )
    op.execute(
        """
        CREATE TRIGGER privileged_audit_events_append_only
        BEFORE UPDATE OR DELETE ON privileged_audit_events
        FOR EACH ROW EXECUTE FUNCTION deny_privileged_audit_event_mutation();
        """
    )


def downgrade() -> None:
    """Remove privileged audit evidence storage."""

    op.execute(
        "DROP TRIGGER IF EXISTS privileged_audit_events_append_only "
        "ON privileged_audit_events"
    )
    op.execute("DROP FUNCTION IF EXISTS deny_privileged_audit_event_mutation()")
    op.drop_index(
        "ix_privileged_audit_events_actor_user_id",
        table_name="privileged_audit_events",
    )
    op.drop_table("privileged_audit_events")
