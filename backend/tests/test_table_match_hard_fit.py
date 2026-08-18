"""Unit tests for deterministic Table Match hard-fit rules."""

from dataclasses import replace
from datetime import UTC, date, datetime
from uuid import uuid4

from app.services.recurrence_expansion import OccurrenceWindow
from app.services.table_match_hard_fit import (
    PlayerCandidateFacts,
    TableCandidateFacts,
    TimeWindow,
    evaluate_player_candidate,
    evaluate_table_candidate,
    intersect_occurrences,
)


def occurrence(start_hour: int, end_hour: int) -> OccurrenceWindow:
    return OccurrenceWindow(
        local_date=date(2026, 8, 22),
        start_at=datetime(2026, 8, 22, start_hour, tzinfo=UTC),
        end_at=datetime(2026, 8, 22, end_hour, tzinfo=UTC),
        timezone="UTC",
    )


def valid_table_facts() -> TableCandidateFacts:
    return TableCandidateFacts(
        gm_signal_status="active",
        venue_active=True,
        venue_verified=True,
        gm_minimum_players=3,
        gm_maximum_players=5,
        venue_max_people_per_table=6,
        gm_distance_miles=8.0,
        gm_travel_radius_miles=25,
        gm_occurrence=occurrence(18, 22),
        venue_occurrence=occurrence(17, 23),
    )


def valid_player_facts() -> PlayerCandidateFacts:
    system_id = uuid4()
    return PlayerCandidateFacts(
        player_system_id=system_id,
        gm_system_id=system_id,
        player_signal_status="active",
        player_format="one_shot",
        gm_format="one_shot",
        player_distance_miles=12.0,
        player_travel_radius_miles=25,
        player_occurrence=occurrence(18, 22),
        table_overlap=TimeWindow(
            start_at=datetime(2026, 8, 22, 18, tzinfo=UTC),
            end_at=datetime(2026, 8, 22, 22, tzinfo=UTC),
        ),
    )


def test_occurrence_intersection_uses_real_timezone_aware_overlap() -> None:
    overlap = intersect_occurrences(occurrence(18, 22), occurrence(20, 23))

    assert overlap is not None
    assert overlap.start_at == datetime(2026, 8, 22, 20, tzinfo=UTC)
    assert overlap.end_at == datetime(2026, 8, 22, 22, tzinfo=UTC)


def test_table_candidate_passes_required_state_schedule_travel_and_capacity() -> None:
    evaluation = evaluate_table_candidate(valid_table_facts())

    assert evaluation.eligible is True
    assert evaluation.overlap is not None
    assert evaluation.effective_maximum_players == 5
    assert {decision.criterion for decision in evaluation.decisions} == {
        "gm_state",
        "venue_state",
        "schedule",
        "gm_distance",
        "venue_capacity",
    }


def test_shared_gm_distance_explanation_does_not_expose_private_mileage() -> None:
    evaluation = evaluate_table_candidate(valid_table_facts())
    decision = next(item for item in evaluation.decisions if item.criterion == "gm_distance")

    assert decision.passed is True
    assert decision.summary == "Venue is within the GM's configured travel radius."
    assert "8.0" not in decision.summary
    assert "25" not in decision.summary
    assert "mile" not in decision.summary.lower()


def test_table_capacity_reserves_one_seat_for_gm() -> None:
    facts = replace(valid_table_facts(), venue_max_people_per_table=3)

    evaluation = evaluate_table_candidate(facts)

    assert evaluation.eligible is False
    assert evaluation.effective_maximum_players == 2
    capacity = next(
        decision for decision in evaluation.decisions if decision.criterion == "venue_capacity"
    )
    assert capacity.passed is False


def test_table_candidate_rejects_unverified_venue() -> None:
    facts = replace(valid_table_facts(), venue_verified=False)

    assert evaluate_table_candidate(facts).eligible is False


def test_table_candidate_rejects_non_overlapping_occurrences() -> None:
    facts = replace(
        valid_table_facts(),
        gm_occurrence=occurrence(18, 20),
        venue_occurrence=occurrence(20, 22),
    )

    evaluation = evaluate_table_candidate(facts)

    assert evaluation.eligible is False
    assert evaluation.overlap is None


def test_player_candidate_passes_system_format_schedule_and_distance() -> None:
    evaluation = evaluate_player_candidate(valid_player_facts())

    assert evaluation.eligible is True
    assert evaluation.overlap is not None


def test_player_any_format_matches_specific_gm_format() -> None:
    facts = replace(valid_player_facts(), player_format="any")

    assert evaluate_player_candidate(facts).eligible is True


def test_player_candidate_rejects_system_mismatch() -> None:
    facts = replace(valid_player_facts(), player_system_id=uuid4())

    assert evaluate_player_candidate(facts).eligible is False


def test_player_candidate_rejects_distance_outside_radius() -> None:
    facts = replace(valid_player_facts(), player_distance_miles=30.0)

    assert evaluate_player_candidate(facts).eligible is False


def test_newcomer_has_no_reputation_gate_in_hard_fit() -> None:
    evaluation = evaluate_player_candidate(valid_player_facts())

    assert evaluation.eligible is True
    assert all("reputation" not in decision.criterion for decision in evaluation.decisions)
