"""Alembic infrastructure tests that do not require a live PostgreSQL server."""

import subprocess
import sys
from pathlib import Path

from alembic.config import Config
from alembic.script import ScriptDirectory

BACKEND_DIR = Path(__file__).resolve().parents[1]
ALEMBIC_INI = BACKEND_DIR / "alembic.ini"


def load_script_directory() -> ScriptDirectory:
    config = Config(str(ALEMBIC_INI))
    return ScriptDirectory.from_config(config)


def test_alembic_configuration_discovers_current_head() -> None:
    script = load_script_directory()

    assert Path(script.dir).resolve() == (BACKEND_DIR / "alembic").resolve()
    assert script.get_heads() == ["0019_distributed_api_rate_limits"]


def test_revision_ids_fit_alembic_version_column() -> None:
    script = load_script_directory()

    for migration in script.walk_revisions():
        assert len(migration.revision) <= 32, migration.revision


def test_alembic_offline_upgrade_emits_current_foundation_tables_without_database() -> None:
    result = subprocess.run(
        [
            sys.executable,
            "-m",
            "alembic",
            "-c",
            str(ALEMBIC_INI),
            "upgrade",
            "head",
            "--sql",
        ],
        cwd=BACKEND_DIR,
        check=False,
        capture_output=True,
        text=True,
    )

    assert result.returncode == 0, result.stderr
    assert "CREATE TABLE users" in result.stdout
    assert "PRIMARY KEY (id)" in result.stdout
    assert "auth_provider_user_id" in result.stdout
    assert "CREATE TABLE user_roles" in result.stdout
    assert "PRIMARY KEY (user_id, role)" in result.stdout
    assert "CREATE TABLE privileged_audit_events" in result.stdout
    assert "privileged_audit_events_append_only" in result.stdout
    assert "deny_privileged_audit_event_mutation" in result.stdout
    assert "CREATE TABLE player_profiles" in result.stdout
    assert "uq_player_profiles_user_id" in result.stdout
    assert "ck_player_profiles_travel_radius_miles" in result.stdout
    assert "ck_player_profiles_preferred_format" in result.stdout
    assert "CREATE TABLE gm_profiles" in result.stdout
    assert "uq_gm_profiles_user_id" in result.stdout
    assert "ck_gm_profiles_travel_radius_miles" in result.stdout
    assert "ck_gm_profiles_gm_style_length" in result.stdout
    assert "CREATE TABLE venues" in result.stdout
    assert "uq_venues_slug" in result.stdout
    assert "ck_venues_venue_type" in result.stdout
    assert "CREATE TABLE venue_managers" in result.stdout
    assert "uq_venue_managers_venue_id_user_id" in result.stdout
    assert "ck_venue_managers_role" in result.stdout
    assert "CREATE TABLE game_systems" in result.stdout
    assert "uq_game_systems_slug" in result.stdout
    assert "ck_game_systems_slug_lowercase" in result.stdout
    assert "CREATE TABLE player_system_experiences" in result.stdout
    assert "uq_player_system_experiences_profile_system" in result.stdout
    assert "ck_player_system_experiences_years_playing" in result.stdout
    assert "ck_player_system_experiences_comfort_level" in result.stdout
    assert "CREATE TABLE gm_system_experiences" in result.stdout
    assert "ck_gm_system_experiences_years_gming" in result.stdout
    assert "ck_gm_system_experiences_preferred_player_experience" in result.stdout
    assert "CREATE TABLE gm_system_formats" in result.stdout
    assert "ck_gm_system_formats_format" in result.stdout
    assert "CREATE TABLE recurring_availability_rules" in result.stdout
    assert "ck_recurring_availability_rules_pattern_fields" in result.stdout
    assert "ck_recurring_availability_rules_timezone_length" in result.stdout
    assert "CREATE TABLE player_availability_windows" in result.stdout
    assert "uq_player_availability_windows_recurring_rule_id" in result.stdout
    assert "CREATE TABLE gm_availability_windows" in result.stdout
    assert "uq_gm_availability_windows_recurring_rule_id" in result.stdout
    assert "CREATE TABLE player_demand_signals" in result.stdout
    assert "ck_player_demand_signals_preferred_format" in result.stdout
    assert "CREATE TABLE gm_supply_signals" in result.stdout
    assert "ck_gm_supply_signals_player_range" in result.stdout
    assert "CREATE TABLE venue_table_windows" in result.stdout
    assert "uq_venue_table_windows_recurring_rule_id" in result.stdout
    assert "CREATE TABLE table_matches" in result.stdout
    assert "ck_table_matches_time_order" in result.stdout
    assert "uq_table_matches_gm_venue_occurrence" in result.stdout
    assert "CREATE TABLE table_match_players" in result.stdout
    assert "ck_table_match_players_distance_miles" in result.stdout
    assert "CREATE TABLE match_explanations" in result.stdout
    assert "uq_match_explanations_match_criterion" in result.stdout
    assert "CREATE TABLE postal_code_centroids" in result.stdout
    assert "uq_postal_code_centroids_country_postal" in result.stdout
    assert "ck_postal_code_centroids_accuracy_range" in result.stdout
    assert "CREATE TABLE game_series" in result.stdout
    assert "uq_game_series_table_match_id" in result.stdout
    assert "CREATE TABLE events" in result.stdout
    assert "uq_events_table_match_id" in result.stdout
    assert "ck_events_status" in result.stdout
    assert "CREATE TABLE table_expectations" in result.stdout
    assert "uq_table_expectations_event_id" in result.stdout
    assert "CREATE TABLE registrations" in result.stdout
    assert "uq_registrations_event_player" in result.stdout
    assert "CREATE TABLE venue_booking_requests" in result.stdout
    assert "uq_venue_booking_requests_table_match_id" in result.stdout
    assert "ck_venue_booking_requests_status" in result.stdout
    assert "CREATE TABLE messages" in result.stdout
    assert "ck_messages_channel_type" in result.stdout
    assert "ck_messages_moderation_status" in result.stdout
    assert "ck_messages_body_length" in result.stdout
    assert "ix_messages_event_channel_created" in result.stdout
    assert "CREATE TABLE api_rate_limit_buckets" in result.stdout
    assert "pk_api_rate_limit_buckets" in result.stdout
    assert "ck_api_rate_limit_buckets_scope_length" in result.stdout
    assert "ck_api_rate_limit_buckets_tokens_nonnegative" in result.stdout
    assert "ix_api_rate_limit_buckets_updated_at" in result.stdout
    assert "INSERT INTO game_systems" in result.stdout
    assert "dnd-5e-2014" in result.stdout
    assert "dnd-5e-2024" in result.stdout
    assert "pathfinder-2e" in result.stdout
    assert "call-of-cthulhu" in result.stdout
    assert "cyberpunk-red" in result.stdout
    assert "shadowrun" in result.stdout
    assert "other-rpg" in result.stdout
    assert "ENABLE ROW LEVEL SECURITY" in result.stdout
    for table in (
        "table_matches",
        "table_match_players",
        "match_explanations",
        "postal_code_centroids",
        "game_series",
        "events",
        "table_expectations",
        "registrations",
        "venue_booking_requests",
        "messages",
        "api_rate_limit_buckets",
    ):
        assert f'ALTER TABLE public."{table}" ENABLE ROW LEVEL SECURITY' in result.stdout
    assert "deny_privileged_audit_event_mutation" in result.stdout
    assert "search_path = pg_catalog" in result.stdout
