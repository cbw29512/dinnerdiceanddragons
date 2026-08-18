"""Canonical request payloads for Step 3 matching-input API tests."""


def player_demand_payload() -> dict:
    return {
        "system_slug": "dnd-5e-2014",
        "preferred_format": "one_shot",
        "preferred_cadence": "monthly",
        "minimum_age_preference": 18,
        "table_style_preferences": ["roleplay-forward"],
        "environment_preferences": ["quieter venue"],
    }


def gm_supply_payload() -> dict:
    return {
        "system_slug": "dnd-5e-2014",
        "preferred_format": "one_shot",
        "preferred_cadence": "monthly",
        "minimum_players": 3,
        "maximum_players": 5,
        "table_style": "Collaborative with clear expectations.",
    }


def venue_table_window_payload() -> dict:
    return {
        "availability": {
            "day_of_week": "friday",
            "start_time": "18:00",
            "end_time": "22:00",
            "pattern_type": "weekly_interval",
            "week_interval": 1,
            "timezone": "America/New_York",
        },
        "table_count": 2,
        "max_people_per_table": 6,
        "purchase_policy": "One purchase per guest.",
        "approval_required": True,
        "special_support_offerings": ["loyalty_rewards", "prize_support"],
        "special_support_notes": "Game Masters earn an extra loyalty punch on RPG night.",
        "environment_notes": "Quieter rear tables preferred for RPG groups.",
    }
