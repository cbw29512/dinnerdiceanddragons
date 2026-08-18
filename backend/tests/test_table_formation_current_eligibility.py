"""Regression tests for eligibility changes after matching or registration."""

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session
from table_formation_test_support import (
    add_eligible_player,
    create_formation_session,
    seed_formation_parents,
)

from app.models.registration import Registration, RegistrationStatus
from app.models.user import AccountStatus
from app.models.user_role import UserRole, UserRoleType
from app.models.venue_booking_request import VenueBookingRequest, VenueBookingStatus
from app.services.event_registration_service import (
    cancel_my_registration,
    decide_event_registration,
    request_event_registration,
)
from app.services.table_formation_conversion import form_table_match
from app.services.table_formation_errors import (
    TableFormationConflictError,
    TableFormationForbiddenError,
)
from app.services.venue_booking_transitions import transition_venue_booking


@pytest.fixture()
def session() -> Session:
    db, engine = create_formation_session()
    try:
        yield db
    finally:
        db.close()
        engine.dispose()


def test_suspended_player_cannot_be_confirmed_after_request(session: Session) -> None:
    seed, event_id, _ = _formed_event(session)
    requested = request_event_registration(
        session,
        event_id=event_id,
        caller_user_id=seed.player_user.id,
        expectations_acknowledged=True,
    )
    seed.player_user.status = AccountStatus.SUSPENDED.value
    session.commit()

    with pytest.raises(TableFormationForbiddenError):
        decide_event_registration(
            session,
            event_id=event_id,
            registration_id=requested.registration_id,
            caller_user_id=seed.gm_user.id,
            target_status=RegistrationStatus.CONFIRMED.value,
        )


def test_revoked_player_role_cannot_be_confirmed_after_request(session: Session) -> None:
    seed, event_id, _ = _formed_event(session)
    requested = request_event_registration(
        session,
        event_id=event_id,
        caller_user_id=seed.player_user.id,
        expectations_acknowledged=True,
    )
    role = session.scalar(
        select(UserRole).where(
            UserRole.user_id == seed.player_user.id,
            UserRole.role == UserRoleType.PLAYER.value,
        )
    )
    assert role is not None
    session.delete(role)
    session.commit()

    with pytest.raises(TableFormationForbiddenError):
        decide_event_registration(
            session,
            event_id=event_id,
            registration_id=requested.registration_id,
            caller_user_id=seed.gm_user.id,
            target_status=RegistrationStatus.CONFIRMED.value,
        )


def test_waitlist_promotion_skips_suspended_player(session: Session) -> None:
    seed = seed_formation_parents(session)
    seed.gm_supply.maximum_players = 1
    seed.table_match.maximum_players = 1
    second_user, _ = add_eligible_player(session, seed, suffix="second")
    third_user, _ = add_eligible_player(session, seed, suffix="third")
    formed = form_table_match(
        session,
        table_match_id=seed.table_match.id,
        caller_user_id=seed.gm_user.id,
        title="Eligibility Waitlist",
    )
    booking = session.get(VenueBookingRequest, formed.venue_booking_request_id)
    assert booking is not None
    transition_venue_booking(
        session,
        booking_id=booking.id,
        caller_user_id=seed.venue_manager_user.id,
        target_status=VenueBookingStatus.APPROVED.value,
    )

    first = _request(session, formed.event_id, seed.player_user.id)
    decide_event_registration(
        session,
        event_id=formed.event_id,
        registration_id=first.registration_id,
        caller_user_id=seed.gm_user.id,
        target_status=RegistrationStatus.CONFIRMED.value,
    )
    second = _request(session, formed.event_id, second_user.id)
    third = _request(session, formed.event_id, third_user.id)
    second_user.status = AccountStatus.SUSPENDED.value
    session.commit()

    cancel_my_registration(
        session,
        event_id=formed.event_id,
        caller_user_id=seed.player_user.id,
    )

    second_registration = session.get(Registration, second.registration_id)
    third_registration = session.get(Registration, third.registration_id)
    assert second_registration is not None and third_registration is not None
    assert second_registration.status == RegistrationStatus.WAITLISTED.value
    assert third_registration.status == RegistrationStatus.CONFIRMED.value


def test_suspended_venue_manager_cannot_approve(session: Session) -> None:
    seed, _, booking = _formed_event(session)
    seed.venue_manager_user.status = AccountStatus.SUSPENDED.value
    session.commit()

    with pytest.raises(TableFormationForbiddenError):
        transition_venue_booking(
            session,
            booking_id=booking.id,
            caller_user_id=seed.venue_manager_user.id,
            target_status=VenueBookingStatus.APPROVED.value,
        )


def test_changed_gm_player_range_requires_rematching(session: Session) -> None:
    seed = seed_formation_parents(session)
    seed.gm_supply.maximum_players = 4
    session.commit()

    with pytest.raises(TableFormationConflictError, match="rerun matching"):
        form_table_match(
            session,
            table_match_id=seed.table_match.id,
            caller_user_id=seed.gm_user.id,
            title="Stale Capacity",
        )


def _formed_event(session: Session):
    seed = seed_formation_parents(session)
    formed = form_table_match(
        session,
        table_match_id=seed.table_match.id,
        caller_user_id=seed.gm_user.id,
        title="Eligibility Regression",
    )
    booking = session.get(VenueBookingRequest, formed.venue_booking_request_id)
    assert booking is not None
    return seed, formed.event_id, booking


def _request(session: Session, event_id, user_id):
    return request_event_registration(
        session,
        event_id=event_id,
        caller_user_id=user_id,
        expectations_acknowledged=True,
    )
