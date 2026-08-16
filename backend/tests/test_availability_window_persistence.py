"""Persistence tests for typed Player and GM availability windows."""

from datetime import time

import pytest
from sqlalchemy import create_engine, event, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.availability_window import GMAvailabilityWindow, PlayerAvailabilityWindow
from app.models.gm_profile import GMProfile
from app.models.player_profile import PlayerProfile
from app.models.recurring_availability_rule import RecurringAvailabilityRule
from app.models.user import AccountStatus, User


def make_session() -> Session:
    engine = create_engine("sqlite+pysqlite:///:memory:")

    @event.listens_for(engine, "connect")
    def enable_foreign_keys(dbapi_connection: object, _: object) -> None:
        cursor = dbapi_connection.cursor()  # type: ignore[attr-defined]
        try:
            cursor.execute("PRAGMA foreign_keys=ON")
        finally:
            cursor.close()

    for table in (
        User.__table__,
        PlayerProfile.__table__,
        GMProfile.__table__,
        RecurringAvailabilityRule.__table__,
        PlayerAvailabilityWindow.__table__,
        GMAvailabilityWindow.__table__,
    ):
        table.create(engine)
    return Session(engine)


def add_profiles(session: Session, suffix: str) -> tuple[PlayerProfile, GMProfile]:
    user = User(
        auth_provider_user_id=f"availability-provider-{suffix}",
        email=f"availability-{suffix}@example.com",
        status=AccountStatus.ACTIVE.value,
    )
    session.add(user)
    session.flush()
    player = PlayerProfile(user_id=user.id, postal_code="29501", travel_radius_miles=25)
    gm = GMProfile(
        user_id=user.id,
        postal_code="29501",
        travel_radius_miles=35,
        gm_style="Collaborative, beginner-friendly table.",
    )
    session.add_all([player, gm])
    session.flush()
    return player, gm


def add_rule(session: Session, day: str, start_hour: int) -> RecurringAvailabilityRule:
    rule = RecurringAvailabilityRule(
        day_of_week=day,
        start_time=time(start_hour, 0),
        end_time=time(start_hour + 3, 0),
        pattern_type="weekly_interval",
        week_interval=1,
        timezone="America/New_York",
    )
    session.add(rule)
    session.flush()
    return rule


def test_one_user_can_hold_independent_player_and_gm_availability() -> None:
    with make_session() as session:
        player, gm = add_profiles(session, "dual-role")
        player_rule = add_rule(session, "friday", 18)
        gm_rule = add_rule(session, "saturday", 17)
        session.add_all(
            [
                PlayerAvailabilityWindow(
                    player_profile_id=player.id, recurring_rule_id=player_rule.id
                ),
                GMAvailabilityWindow(gm_profile_id=gm.id, recurring_rule_id=gm_rule.id),
            ]
        )
        session.commit()
        player_window = session.scalar(select(PlayerAvailabilityWindow))
        gm_window = session.scalar(select(GMAvailabilityWindow))
        assert player_window is not None and player_window.active is True
        assert gm_window is not None and gm_window.active is True
        assert player_window.recurring_rule_id != gm_window.recurring_rule_id


def test_profile_can_have_multiple_or_set_windows() -> None:
    with make_session() as session:
        player, _ = add_profiles(session, "multiple")
        friday = add_rule(session, "friday", 18)
        sunday = add_rule(session, "sunday", 14)
        session.add_all(
            [
                PlayerAvailabilityWindow(player_profile_id=player.id, recurring_rule_id=friday.id),
                PlayerAvailabilityWindow(player_profile_id=player.id, recurring_rule_id=sunday.id),
            ]
        )
        session.commit()
        assert len(session.scalars(select(PlayerAvailabilityWindow)).all()) == 2


@pytest.mark.parametrize("window_type", ["player", "gm"])
def test_same_rule_cannot_be_reused_in_same_window_type(window_type: str) -> None:
    with make_session() as session:
        player, gm = add_profiles(session, f"unique-{window_type}")
        rule = add_rule(session, "tuesday", 18)
        if window_type == "player":
            first = PlayerAvailabilityWindow(player_profile_id=player.id, recurring_rule_id=rule.id)
            second = PlayerAvailabilityWindow(
                player_profile_id=player.id, recurring_rule_id=rule.id
            )
        else:
            first = GMAvailabilityWindow(gm_profile_id=gm.id, recurring_rule_id=rule.id)
            second = GMAvailabilityWindow(gm_profile_id=gm.id, recurring_rule_id=rule.id)
        session.add_all([first, second])
        with pytest.raises(IntegrityError):
            session.commit()


def test_profile_delete_cascades_window_but_keeps_schedule_value() -> None:
    with make_session() as session:
        player, _ = add_profiles(session, "profile-delete")
        rule = add_rule(session, "wednesday", 18)
        window = PlayerAvailabilityWindow(player_profile_id=player.id, recurring_rule_id=rule.id)
        session.add(window)
        session.commit()
        session.delete(player)
        session.commit()
        assert session.get(PlayerAvailabilityWindow, window.id) is None
        assert session.get(RecurringAvailabilityRule, rule.id) is not None


def test_rule_delete_cascades_linked_window() -> None:
    with make_session() as session:
        _, gm = add_profiles(session, "rule-delete")
        rule = add_rule(session, "thursday", 18)
        window = GMAvailabilityWindow(gm_profile_id=gm.id, recurring_rule_id=rule.id)
        session.add(window)
        session.commit()
        session.delete(rule)
        session.commit()
        assert session.get(GMAvailabilityWindow, window.id) is None
