"""create public venues and manager relationships

Revision ID: 0006_venue_manager
Revises: 0005_gm_profile
Create Date: 2026-08-15
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "0006_venue_manager"
down_revision: str | Sequence[str] | None = "0005_gm_profile"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create public Venue records and User ↔ Venue manager relationships."""

    op.create_table(
        "venues",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("slug", sa.String(length=180), nullable=False),
        sa.Column(
            "venue_type",
            sa.String(length=32),
            nullable=False,
            server_default="public_venue",
        ),
        sa.Column("address_line1", sa.String(length=200), nullable=False),
        sa.Column("address_line2", sa.String(length=200), nullable=True),
        sa.Column("city", sa.String(length=100), nullable=False),
        sa.Column("state_region", sa.String(length=2), nullable=False),
        sa.Column("postal_code", sa.String(length=5), nullable=False),
        sa.Column("latitude", sa.Float(), nullable=True),
        sa.Column("longitude", sa.Float(), nullable=True),
        sa.Column("website_url", sa.String(length=500), nullable=True),
        sa.Column("phone", sa.String(length=40), nullable=True),
        sa.Column(
            "verified",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column(
            "amenities",
            sa.JSON(),
            nullable=False,
            server_default=sa.text("'[]'"),
        ),
        sa.Column("accessibility_notes", sa.Text(), nullable=True),
        sa.Column("parking_notes", sa.Text(), nullable=True),
        sa.Column("noise_notes", sa.Text(), nullable=True),
        sa.Column("lighting_notes", sa.Text(), nullable=True),
        sa.Column(
            "active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.CheckConstraint(
            "length(trim(name)) BETWEEN 1 AND 160",
            name="ck_venues_name_length",
        ),
        sa.CheckConstraint(
            "length(trim(slug)) BETWEEN 1 AND 180",
            name="ck_venues_slug_length",
        ),
        sa.CheckConstraint("slug = lower(slug)", name="ck_venues_slug_lowercase"),
        sa.CheckConstraint(
            "venue_type IN "
            "('restaurant', 'brewery', 'cafe', 'game_store', 'library', "
            "'community_center', 'public_venue', 'other')",
            name="ck_venues_venue_type",
        ),
        sa.CheckConstraint(
            "length(state_region) = 2",
            name="ck_venues_state_region_length",
        ),
        sa.CheckConstraint(
            "state_region = upper(state_region)",
            name="ck_venues_state_region_uppercase",
        ),
        sa.CheckConstraint(
            "length(postal_code) = 5",
            name="ck_venues_postal_code_length",
        ),
        sa.CheckConstraint(
            "latitude IS NULL OR latitude BETWEEN -90 AND 90",
            name="ck_venues_latitude_range",
        ),
        sa.CheckConstraint(
            "longitude IS NULL OR longitude BETWEEN -180 AND 180",
            name="ck_venues_longitude_range",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_venues"),
        sa.UniqueConstraint("slug", name="uq_venues_slug"),
    )

    op.create_table(
        "venue_managers",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("venue_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column(
            "role",
            sa.String(length=24),
            nullable=False,
            server_default="manager",
        ),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "role IN ('owner', 'manager', 'staff')",
            name="ck_venue_managers_role",
        ),
        sa.ForeignKeyConstraint(
            ["venue_id"],
            ["venues.id"],
            name="fk_venue_managers_venue_id_venues",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name="fk_venue_managers_user_id_users",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_venue_managers"),
        sa.UniqueConstraint(
            "venue_id",
            "user_id",
            name="uq_venue_managers_venue_id_user_id",
        ),
    )
    op.create_index("ix_venue_managers_venue_id", "venue_managers", ["venue_id"])
    op.create_index("ix_venue_managers_user_id", "venue_managers", ["user_id"])


def downgrade() -> None:
    """Remove Venue Manager relationships and public Venues."""

    op.drop_index("ix_venue_managers_user_id", table_name="venue_managers")
    op.drop_index("ix_venue_managers_venue_id", table_name="venue_managers")
    op.drop_table("venue_managers")
    op.drop_table("venues")
