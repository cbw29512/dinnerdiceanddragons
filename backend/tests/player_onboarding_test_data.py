"""Canonical request payloads used by Player onboarding tests."""


def player_payload() -> dict:
    """Return one valid canonical Player onboarding request."""

    try:
        return {
            "display_name": "Alice Adventurer",
            "bio": "Looking for a consistent local table.",
            "postal_code": "29501",
            "travel_radius_miles": 25,
            "preferred_format": "short_campaign",
            "willing_to_learn_new_system": True,
            "environment_preferences": ["quieter venue"],
            "accessibility_notes_private": "Seat with a clear path, please.",
            "systems": [
                {
                    "system_slug": "dnd-5e-2014",
                    "years_playing": 4.5,
                    "comfort_level": "comfortable",
                    "experience_notes": "Comfortable with core rules.",
                }
            ],
            "availability": [
                {
                    "day_of_week": "saturday",
                    "start_time": "18:00",
                    "end_time": "21:00",
                    "pattern_type": "weekly_interval",
                    "week_interval": 1,
                    "timezone": "America/New_York",
                }
            ],
        }
    except Exception:
        raise
