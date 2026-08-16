"""Authorization tests for typed Player and GM availability windows."""

from datetime import time
from uuid import uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.api.dependencies.availability_access import (
    require_gm_availability_owner,
    require_player_availability_owner,
)
from app.models.availability_window import GMAvailabilityWindow, PlayerAvailabilityWindow
from app.models.gm_profile import GMProfile
from app.models.player_profile import PlayerProfile
from app.models.recurring_availability_rule import RecurringAvailabilityRule
from app.models.user import AccountStatus, User


def make_session() -> Session:
    engine = create_engine("sqlite+pysqlite:///:memory:")
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


def add_user(session: Session, label: str) -> User:
    user = User(
        auth_provider_user_id=f"availability-auth-{label}-{uuid4()}",
        email=f"availability-auth-{label}-{uuid4()}@example.com",
        status=AccountStatus.ACTIVE.value,
    )
    session.add(user)
    session.flush()
    return user


def add_rule(session: Session, day: str) -> RecurringAvailabilityRule:
    rule = RecurringAvailabilityRule(
        day_of_week=day,
        start_time=time(18, 0),
        end_time=time(21, 0),
        pattern_type="weekly_interval",
        week_interval=1,
        timezone="America/New_York",
    )
    session.add(rule)
    session.flush()
    return rule


def assert_forbidden(callable_) -> None:
    with pytest.raises(HTTPException) as exc_info:
        callable_()
    assert exc_info.value.status_code == 403


def test_player_window_owner_is_derived_from_parent_profile() -> None:
    with make_session() as session:
        alice = add_user(session, "alice-player")
        bob = add_user(session, "bob-player")
        profile = PlayerProfile(user_id=alice.id, postal_code="29501", travel_radius_miles=25)
        session.add(profile)
        session.flush()
        rule = add_rule(session, "friday")
        window = PlayerAvailabilityWindow(
            player_profile_id=profile.id,
            recurring_rule_id=rule.id,
        )
        session.add(window)
        session.commit()

        assert require_player_availability_owner(alice, window, session) is alice
        assert_forbidden(lambda: require_player_availability_owner(bob, window, session))


def test_gm_window_owner_is_derived_from_parent_profile() -> None:
    with make_session() as session:
        alice = add_user(session, "alice-gm")
        bob = add_user(session, "bob-gm")
        profile = GMProfile(
            user_id=alice.id,
            postal_code="29501",
            travel_radius_miles=35,
            gm_style="Collaborative table.",
        )
        session.add(profile)
        session.flush()
        rule = add_rule(session, "saturday")
        window = GMAvailabilityWindow(
            gm_profile_id=profile.id,
            recurring_rule_id=rule.id,
        )
        session.add(window)
        session.commit()

        assert require_gm_availability_owner(alice, window, session) is alice
        assert_forbidden(lambda: require_gm_availability_owner(bob, window, session))


def test_missing_parent_profile_returns_not_found() -> None:
    with make_session() as session:
        actor = add_user(session, "missing-parent")
        window = PlayerAvailabilityWindow(
            player_profile_id=uuid4(),
            recurring_rule_id=uuid4(),
        )
        with pytest.raises(HTTPException) as exc_info:
            require_player_availability_owner(actor, window, session)
        assert exc_info.value.status_code == 404


def test_database_lookup_failure_returns_controlled_server_error(monkeypatch) -> None:
    with make_session() as session:
        actor = add_user(session, "db-error")
        window = PlayerAvailabilityWindow(
            player_profile_id=uuid4(),
            recurring_rule_id=uuid4(),
        )

        def fail_scalar(*_args, **_kwargs):
            raise SQLAlchemyError("simulated ownership lookup failure")

        monkeypatch.setattr(session, "scalar", fail_scalar)
        with pytest.raises(HTTPException) as exc_info:
            require_player_availability_owner(actor, window, session)
        assert exc_info.value.status_code == 500
        assert exc_info.value.detail == "Availability ownership could not be verified."
