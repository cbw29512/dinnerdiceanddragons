"""create production table formation and event state

Revision ID: 0017_table_formation
Revises: 0016_postal_centroid_cache
Create Date: 2026-08-18
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "0017_table_formation"
down_revision: str | Sequence[str] | None = "0016_postal_centroid_cache"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create durable booking, Event, expectations, and registration state."""

    _create_game_series()
    _create_events()
    _create_table_expectations()
    _create_registrations()
    _create_venue_booking_requests()

    for table_name in (
        "game_series",
        "events",
        "table_expectations",
        "registrations",
        "venue_booking_requests",
    ):
        op.execute(f'ALTER TABLE public."{table_name}" ENABLE ROW LEVEL SECURITY')


def _create_game_series() -> None:
    op.create_table(
        "game_series",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("table_match_id", sa.Uuid(), nullable=True),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("gm_profile_id", sa.Uuid(), nullable=False),
        sa.Column("game_system_id", sa.Uuid(), nullable=False),
        sa.Column("venue_id", sa.Uuid(), nullable=False),
        sa.Column("recurring_rule_id", sa.Uuid(), nullable=True),
        sa.Column("expected_sessions", sa.Integer(), server_default="1", nullable=False),
        sa.Column("starts_on", sa.Date(), nullable=False),
        sa.Column("ends_on", sa.Date(), nullable=True),
        sa.Column("active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.CheckConstraint(
            "length(trim(title)) BETWEEN 1 AND 200",
            name="ck_game_series_title_length",
        ),
        sa.CheckConstraint(
            "expected_sessions >= 1",
            name="ck_game_series_expected_sessions",
        ),
        sa.CheckConstraint(
            "ends_on IS NULL OR starts_on <= ends_on",
            name="ck_game_series_date_order",
        ),
        sa.ForeignKeyConstraint(
            ["table_match_id"],
            ["table_matches.id"],
            name="fk_game_series_table_match",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["gm_profile_id"],
            ["gm_profiles.id"],
            name="fk_game_series_gm_profile",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["game_system_id"],
            ["game_systems.id"],
            name="fk_game_series_game_system",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["venue_id"],
            ["venues.id"],
            name="fk_game_series_venue",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["recurring_rule_id"],
            ["recurring_availability_rules.id"],
            name="fk_game_series_recurring_rule",
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_game_series"),
        sa.UniqueConstraint("table_match_id", name="uq_game_series_table_match_id"),
        sa.UniqueConstraint("recurring_rule_id", name="uq_game_series_recurring_rule_id"),
    )
    op.create_index("ix_game_series_gm_profile_id", "game_series", ["gm_profile_id"])
    op.create_index("ix_game_series_game_system_id", "game_series", ["game_system_id"])
    op.create_index("ix_game_series_venue_id", "game_series", ["venue_id"])


def _create_events() -> None:
    op.create_table(
        "events",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("game_series_id", sa.Uuid(), nullable=True),
        sa.Column("table_match_id", sa.Uuid(), nullable=True),
        sa.Column("slug", sa.String(length=180), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("gm_profile_id", sa.Uuid(), nullable=False),
        sa.Column("game_system_id", sa.Uuid(), nullable=False),
        sa.Column("venue_id", sa.Uuid(), nullable=False),
        sa.Column("event_type", sa.String(length=32), nullable=False),
        sa.Column("join_mode", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=24), server_default="draft", nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("min_players", sa.SmallInteger(), nullable=False),
        sa.Column("max_players", sa.SmallInteger(), nullable=False),
        sa.Column("minimum_age", sa.SmallInteger(), nullable=True),
        sa.Column("beginner_friendly", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("length(trim(slug)) BETWEEN 1 AND 180", name="ck_events_slug_length"),
        sa.CheckConstraint("slug = lower(slug)", name="ck_events_slug_lowercase"),
        sa.CheckConstraint("length(trim(title)) BETWEEN 1 AND 200", name="ck_events_title_length"),
        sa.CheckConstraint(
            "length(trim(event_type)) BETWEEN 1 AND 32",
            name="ck_events_event_type_length",
        ),
        sa.CheckConstraint(
            "length(trim(join_mode)) BETWEEN 1 AND 32",
            name="ck_events_join_mode_length",
        ),
        sa.CheckConstraint(
            "status IN ('draft', 'venue_requested', 'forming', 'confirmed', 'full', 'cancelled', 'completed')",
            name="ck_events_status",
        ),
        sa.CheckConstraint("ends_at > starts_at", name="ck_events_time_order"),
        sa.CheckConstraint("min_players >= 1", name="ck_events_min_players"),
        sa.CheckConstraint("max_players >= min_players", name="ck_events_player_range"),
        sa.CheckConstraint(
            "minimum_age IS NULL OR minimum_age BETWEEN 0 AND 120",
            name="ck_events_minimum_age",
        ),
        sa.ForeignKeyConstraint(
            ["game_series_id"],
            ["game_series.id"],
            name="fk_events_game_series",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["table_match_id"],
            ["table_matches.id"],
            name="fk_events_table_match",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["gm_profile_id"],
            ["gm_profiles.id"],
            name="fk_events_gm_profile",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["game_system_id"],
            ["game_systems.id"],
            name="fk_events_game_system",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["venue_id"],
            ["venues.id"],
            name="fk_events_venue",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_events"),
        sa.UniqueConstraint("slug", name="uq_events_slug"),
        sa.UniqueConstraint("table_match_id", name="uq_events_table_match_id"),
    )
    op.create_index("ix_events_game_series_id", "events", ["game_series_id"])
    op.create_index("ix_events_gm_profile_id", "events", ["gm_profile_id"])
    op.create_index("ix_events_game_system_id", "events", ["game_system_id"])
    op.create_index("ix_events_venue_id", "events", ["venue_id"])
    op.create_index("ix_events_status", "events", ["status"])
    op.create_index("ix_events_starts_at", "events", ["starts_at"])


def _create_table_expectations() -> None:
    op.create_table(
        "table_expectations",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("event_id", sa.Uuid(), nullable=False),
        sa.Column("tone", sa.String(length=80), nullable=True),
        sa.Column("age_expectation", sa.String(length=120), nullable=True),
        sa.Column("table_style", sa.String(length=160), nullable=True),
        sa.Column("pvp_policy", sa.String(length=120), nullable=True),
        sa.Column("homebrew_policy", sa.String(length=200), nullable=True),
        sa.Column("character_death_policy", sa.String(length=200), nullable=True),
        sa.Column("mature_content_policy", sa.String(length=200), nullable=True),
        sa.Column("alcohol_policy", sa.String(length=200), nullable=True),
        sa.Column("new_players_welcome", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("break_policy", sa.String(length=200), nullable=True),
        sa.Column("safety_framework", sa.Text(), nullable=True),
        sa.Column("environment_notes", sa.Text(), nullable=True),
        sa.Column("accessibility_notes", sa.Text(), nullable=True),
        sa.Column("other_notes", sa.Text(), nullable=True),
        sa.CheckConstraint(
            "tone IS NULL OR length(trim(tone)) BETWEEN 1 AND 80",
            name="ck_table_expectations_tone_length",
        ),
        sa.CheckConstraint(
            "age_expectation IS NULL OR length(trim(age_expectation)) BETWEEN 1 AND 120",
            name="ck_table_expectations_age_length",
        ),
        sa.CheckConstraint(
            "table_style IS NULL OR length(trim(table_style)) BETWEEN 1 AND 160",
            name="ck_table_expectations_style_length",
        ),
        sa.ForeignKeyConstraint(
            ["event_id"],
            ["events.id"],
            name="fk_table_expectations_event",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_table_expectations"),
        sa.UniqueConstraint("event_id", name="uq_table_expectations_event_id"),
    )


def _create_registrations() -> None:
    op.create_table(
        "registrations",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("event_id", sa.Uuid(), nullable=False),
        sa.Column("player_profile_id", sa.Uuid(), nullable=False),
        sa.Column("status", sa.String(length=16), server_default="requested", nullable=False),
        sa.Column("expectations_acknowledged_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("requested_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("responded_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "status IN ('requested', 'confirmed', 'waitlisted', 'declined', 'cancelled', 'removed')",
            name="ck_registrations_status",
        ),
        sa.ForeignKeyConstraint(
            ["event_id"],
            ["events.id"],
            name="fk_registrations_event",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["player_profile_id"],
            ["player_profiles.id"],
            name="fk_registrations_player_profile",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_registrations"),
        sa.UniqueConstraint(
            "event_id",
            "player_profile_id",
            name="uq_registrations_event_player",
        ),
    )
    op.create_index("ix_registrations_event_id", "registrations", ["event_id"])
    op.create_index("ix_registrations_player_profile_id", "registrations", ["player_profile_id"])
    op.create_index("ix_registrations_status", "registrations", ["status"])


def _create_venue_booking_requests() -> None:
    op.create_table(
        "venue_booking_requests",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("venue_table_window_id", sa.Uuid(), nullable=False),
        sa.Column("gm_profile_id", sa.Uuid(), nullable=False),
        sa.Column("table_match_id", sa.Uuid(), nullable=True),
        sa.Column("game_series_id", sa.Uuid(), nullable=True),
        sa.Column("event_id", sa.Uuid(), nullable=True),
        sa.Column("requested_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("requested_end", sa.DateTime(timezone=True), nullable=False),
        sa.Column("tables_requested", sa.Integer(), nullable=False),
        sa.Column("expected_guests", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=16), server_default="requested", nullable=False),
        sa.Column("venue_message", sa.Text(), nullable=True),
        sa.Column("gm_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint(
            "status IN ('requested', 'question', 'approved', 'declined', 'cancelled')",
            name="ck_venue_booking_requests_status",
        ),
        sa.CheckConstraint(
            "requested_end > requested_start",
            name="ck_venue_booking_requests_time_order",
        ),
        sa.CheckConstraint(
            "tables_requested >= 1",
            name="ck_venue_booking_requests_tables_requested",
        ),
        sa.CheckConstraint(
            "expected_guests >= 1",
            name="ck_venue_booking_requests_expected_guests",
        ),
        sa.ForeignKeyConstraint(
            ["venue_table_window_id"],
            ["venue_table_windows.id"],
            name="fk_venue_booking_requests_window",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["gm_profile_id"],
            ["gm_profiles.id"],
            name="fk_venue_booking_requests_gm_profile",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["table_match_id"],
            ["table_matches.id"],
            name="fk_venue_booking_requests_table_match",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["game_series_id"],
            ["game_series.id"],
            name="fk_venue_booking_requests_game_series",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["event_id"],
            ["events.id"],
            name="fk_venue_booking_requests_event",
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_venue_booking_requests"),
        sa.UniqueConstraint(
            "table_match_id",
            name="uq_venue_booking_requests_table_match_id",
        ),
        sa.UniqueConstraint("event_id", name="uq_venue_booking_requests_event_id"),
    )
    op.create_index(
        "ix_venue_booking_requests_venue_table_window_id",
        "venue_booking_requests",
        ["venue_table_window_id"],
    )
    op.create_index(
        "ix_venue_booking_requests_gm_profile_id",
        "venue_booking_requests",
        ["gm_profile_id"],
    )
    op.create_index(
        "ix_venue_booking_requests_game_series_id",
        "venue_booking_requests",
        ["game_series_id"],
    )
    op.create_index(
        "ix_venue_booking_requests_requested_start",
        "venue_booking_requests",
        ["requested_start"],
    )
    op.create_index("ix_venue_booking_requests_status", "venue_booking_requests", ["status"])


def downgrade() -> None:
    """Remove table formation state in reverse dependency order."""

    op.drop_index("ix_venue_booking_requests_status", table_name="venue_booking_requests")
    op.drop_index("ix_venue_booking_requests_requested_start", table_name="venue_booking_requests")
    op.drop_index("ix_venue_booking_requests_game_series_id", table_name="venue_booking_requests")
    op.drop_index("ix_venue_booking_requests_gm_profile_id", table_name="venue_booking_requests")
    op.drop_index("ix_venue_booking_requests_venue_table_window_id", table_name="venue_booking_requests")
    op.drop_table("venue_booking_requests")

    op.drop_index("ix_registrations_status", table_name="registrations")
    op.drop_index("ix_registrations_player_profile_id", table_name="registrations")
    op.drop_index("ix_registrations_event_id", table_name="registrations")
    op.drop_table("registrations")

    op.drop_table("table_expectations")

    op.drop_index("ix_events_starts_at", table_name="events")
    op.drop_index("ix_events_status", table_name="events")
    op.drop_index("ix_events_venue_id", table_name="events")
    op.drop_index("ix_events_game_system_id", table_name="events")
    op.drop_index("ix_events_gm_profile_id", table_name="events")
    op.drop_index("ix_events_game_series_id", table_name="events")
    op.drop_table("events")

    op.drop_index("ix_game_series_venue_id", table_name="game_series")
    op.drop_index("ix_game_series_game_system_id", table_name="game_series")
    op.drop_index("ix_game_series_gm_profile_id", table_name="game_series")
    op.drop_table("game_series")
