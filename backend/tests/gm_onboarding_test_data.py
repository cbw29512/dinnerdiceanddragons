"""Canonical request payloads used by GM onboarding tests."""


def gm_payload() -> dict:
    """Return one valid canonical GM onboarding request."""

    try:
        return {
            "display_name": "Alice Adventurer",
            "bio": "I like reliable local tables and clear expectations.",
            "postal_code": "29501",
            "travel_radius_miles": 30,
            "beginner_friendly": True,
            "gm_style": "Roleplay-forward with tactical combat and clear table rules.",
            "systems": [
                {
                    "system_slug": "dnd-5e-2014",
                    "years_playing": 8.0,
                    "years_gming": 5.0,
                    "comfort_level": "very_comfortable",
                    "preferred_player_experience": "any",
                    "formats": ["one_shot", "short_campaign"],
                    "experience_notes": "Comfortable teaching new Players.",
                }
            ],
            "availability": [
                {
                    "day_of_week": "saturday",
                    "start_time": "17:00",
                    "end_time": "22:00",
                    "pattern_type": "weekly_interval",
                    "week_interval": 1,
                    "timezone": "America/New_York",
                }
            ],
        }
    except Exception:
        raise
