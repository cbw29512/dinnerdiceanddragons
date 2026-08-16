"""create recurring availability rule persistence

Revision ID: 0010_recurring_availability_rule
Revises: 0009_gm_system_experience
Create Date: 2026-08-15
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "0010_recurring_availability_rule"
down_revision: str | Sequence[str] | None = "0009_gm_system_experience"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create owner-neutral recurring schedule value objects."""

    op.create_table(
        "recurring_availability_rules",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("day_of_week", sa.String(length=16), nullable=False),
        sa.Column("start_time", sa.Time(timezone=False), nullable=False),
        sa.Column("end_time", sa.Time(timezone=False), nullable=False),
        sa.Column("pattern_type", sa.String(length=32), nullable=False),
        sa.Column("week_interval", sa.SmallInteger(), nullable=True),
        sa.Column("anchor_date", sa.Date(), nullable=True),
        sa.Column("monthly_ordinal", sa.String(length=16), nullable=True),
        sa.Column("month_interval", sa.SmallInteger(), nullable=True),
        sa.Column("timezone", sa.String(length=64), nullable=False),
        sa.Column("starts_on", sa.Date(), nullable=True),
        sa.Column("ends_on", sa.Date(), nullable=True),
        sa.Column("active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint(
            "day_of_week IN ('monday', 'tuesday', 'wednesday', 'thursday', "
            "'friday', 'saturday', 'sunday')",
            name="ck_recurring_availability_rules_day_of_week",
        ),
        sa.CheckConstraint(
            "pattern_type IN ('weekly_interval', 'monthly_ordinal_weekday')",
            name="ck_recurring_availability_rules_pattern_type",
        ),
        sa.CheckConstraint(
            "start_time < end_time",
            name="ck_recurring_availability_rules_time_order",
        ),
        sa.CheckConstraint(
            "starts_on IS NULL OR ends_on IS NULL OR starts_on <= ends_on",
            name="ck_recurring_availability_rules_date_order",
        ),
        sa.CheckConstraint(
            "length(trim(timezone)) BETWEEN 1 AND 64",
            name="ck_recurring_availability_rules_timezone_length",
        ),
        sa.CheckConstraint(
            "(pattern_type = 'weekly_interval' "
            "AND week_interval IS NOT NULL "
            "AND week_interval BETWEEN 1 AND 4 "
            "AND monthly_ordinal IS NULL "
            "AND month_interval IS NULL "
            "AND ((week_interval = 1 AND anchor_date IS NULL) "
            "OR (week_interval BETWEEN 2 AND 4 AND anchor_date IS NOT NULL))) "
            "OR (pattern_type = 'monthly_ordinal_weekday' "
            "AND week_interval IS NULL "
            "AND monthly_ordinal IS NOT NULL "
            "AND monthly_ordinal IN ('first', 'second', 'third', 'fourth', 'last') "
            "AND month_interval IS NOT NULL "
            "AND month_interval BETWEEN 1 AND 3 "
            "AND ((month_interval = 1 AND anchor_date IS NULL) "
            "OR (month_interval BETWEEN 2 AND 3 AND anchor_date IS NOT NULL)))",
            name="ck_recurring_availability_rules_pattern_fields",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_recurring_availability_rules"),
    )


def downgrade() -> None:
    """Remove recurring availability rule persistence."""

    op.drop_table("recurring_availability_rules")
