"""Database-level integrity constraints for the persistent GameTable."""

from sqlalchemy import CheckConstraint, UniqueConstraint

GAME_TABLE_CONSTRAINTS = (
    UniqueConstraint(
        "source_table_match_id",
        name="uq_game_tables_source_table_match_id",
    ),
    CheckConstraint(
        "length(trim(title)) BETWEEN 1 AND 200",
        name="ck_game_tables_title_length",
    ),
    CheckConstraint(
        "lifecycle_status IN ('draft', 'forming', 'ready', 'confirmed', "
        "'in_progress', 'completed', 'cancelled', 'archived')",
        name="ck_game_tables_lifecycle_status",
    ),
    CheckConstraint(
        "game_format IN ('learn_to_play', 'one_shot', 'short_campaign', "
        "'long_campaign', 'organized_play')",
        name="ck_game_tables_game_format",
    ),
    CheckConstraint(
        "join_policy IN ('open', 'request', 'invite_only')",
        name="ck_game_tables_join_policy",
    ),
    CheckConstraint(
        "visibility IN ('public', 'unlisted', 'private')",
        name="ck_game_tables_visibility",
    ),
    CheckConstraint(
        "minimum_players >= 1",
        name="ck_game_tables_minimum_players",
    ),
    CheckConstraint(
        "maximum_players >= minimum_players",
        name="ck_game_tables_player_range",
    ),
    CheckConstraint(
        "minimum_age IS NULL OR minimum_age >= 0",
        name="ck_game_tables_minimum_age",
    ),
    CheckConstraint(
        "(proposed_start IS NULL AND proposed_end IS NULL AND timezone IS NULL) OR "
        "(proposed_start IS NOT NULL AND proposed_end IS NOT NULL AND timezone IS NOT NULL "
        "AND proposed_end > proposed_start)",
        name="ck_game_tables_proposed_schedule",
    ),
)

__all__ = ["GAME_TABLE_CONSTRAINTS"]
