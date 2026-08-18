"""Rendering helpers for shared Event table expectations."""

from app.models.table_expectations import TableExpectations
from app.schemas.table_formation import EventExpectationsResponse


def render_event_expectations(
    expectations: TableExpectations,
) -> EventExpectationsResponse:
    """Return the shared, non-private expectations payload for one Event."""

    return EventExpectationsResponse(
        tone=expectations.tone,
        age_expectation=expectations.age_expectation,
        table_style=expectations.table_style,
        pvp_policy=expectations.pvp_policy,
        homebrew_policy=expectations.homebrew_policy,
        character_death_policy=expectations.character_death_policy,
        mature_content_policy=expectations.mature_content_policy,
        alcohol_policy=expectations.alcohol_policy,
        new_players_welcome=expectations.new_players_welcome,
        break_policy=expectations.break_policy,
        safety_framework=expectations.safety_framework,
        environment_notes=expectations.environment_notes,
        accessibility_notes=expectations.accessibility_notes,
        other_notes=expectations.other_notes,
    )


__all__ = ["render_event_expectations"]
