"""Unit tests for deterministic Table Match hard-fit rules."""

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


def test_table_capacity_reserves_one_seat_for_gm() -> None:
    facts = valid_table_facts()
    facts = TableCandidateFacts(
        **{
            **facts.__dict__,
            "venue_max_people_per_table": 3,
        }
    )

    evaluation = evaluate_table_candidate(facts)

    assert evaluation.eligible is False
    assert evaluation.effective_maximum_players == 2
    capacity = next(
        decision for decision in evaluation.decisions if decision.criterion == "venue_capacity"
    )
    assert capacity.passed is False


def test_table_candidate_rejects_unverified_venue() -> None:
    facts = valid_table_facts()
    facts = TableCandidateFacts(
        gm_signal_status=facts.gm_signal_status,
        venue_active=facts.venue_active,
        venue_verified=False,
        gm_minimum_players=facts.gm_minimum_players,
        gm_maximum_players=facts.gm_maximum_players,
        venue_max_people_per_table=facts.venue_max_people_per_table,
        gm_distance_miles=facts.gm_distance_miles,
        gm_travel_radius_miles=facts.gm_travel_radius_miles,
        gm_occurrence=facts.gm_occurrence,
        venue_occurrence=facts.venue_occurrence,
    )

    assert evaluate_table_candidate(facts).eligible is False


def test_table_candidate_rejects_non_overlapping_occurrences() -> None:
    facts = valid_table_facts()
    facts = TableCandidateFacts(
        gm_signal_status=facts.gm_signal_status,
        venue_active=facts.venue_active,
        venue_verified=facts.venue_verified,
        gm_minimum_players=facts.gm_minimum_players,
        gm_maximum_players=facts.gm_maximum_players,
        venue_max_people_per_table=facts.venue_max_people_per_table,
        gm_distance_miles=facts.gm_distance_miles,
        gm_travel_radius_miles=facts.gm_travel_radius_miles,
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
    facts = valid_player_facts()
    facts = PlayerCandidateFacts(
        player_system_id=facts.player_system_id,
        gm_system_id=facts.gm_system_id,
        player_signal_status=facts.player_signal_status,
        player_format="any",
        gm_format=facts.gm_format,
        player_distance_miles=facts.player_distance_miles,
        player_travel_radius_miles=facts.player_travel_radius_miles,
        player_occurrence=facts.player_occurrence,
        table_overlap=facts.table_overlap,
    )

    assert evaluate_player_candidate(facts).eligible is True


def test_player_candidate_rejects_system_mismatch() -> None:
    facts = valid_player_facts()
    facts = PlayerCandidateFacts(
        player_system_id=uuid4(),
        gm_system_id=facts.gm_system_id,
        player_signal_status=facts.player_signal_status,
        player_format=facts.player_format,
        gm_format=facts.gm_format,
        player_distance_miles=facts.player_distance_miles,
        player_travel_radius_miles=facts.player_travel_radius_miles,
        player_occurrence=facts.player_occurrence,
        table_overlap=facts.table_overlap,
    )

    assert evaluate_player_candidate(facts).eligible is False


def test_player_candidate_rejects_distance_outside_radius() -> None:
    facts = valid_player_facts()
    facts = PlayerCandidateFacts(
        player_system_id=facts.player_system_id,
        gm_system_id=facts.gm_system_id,
        player_signal_status=facts.player_signal_status,
        player_format=facts.player_format,
        gm_format=facts.gm_format,
        player_distance_miles=30.0,
        player_travel_radius_miles=25,
        player_occurrence=facts.player_occurrence,
        table_overlap=facts.table_overlap,
    )

    assert evaluate_player_candidate(facts).eligible is False


def test_newcomer_has_no_reputation_gate_in_hard_fit() -> None:
    evaluation = evaluate_player_candidate(valid_player_facts())

    assert evaluation.eligible is True
    assert all("reputation" not in decision.criterion for decision in evaluation.decisions)
