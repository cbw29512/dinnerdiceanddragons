"""Production-session regressions for Event eligibility, headcount, and waitlists."""

import pytest
from event_lifecycle_test_support import build_lifecycle_factory
from sqlalchemy import delete, select

from app.models.event import Event, EventJoinMode, EventStatus
from app.models.matching_signal import SignalStatus
from app.models.player_demand_signal import PlayerDemandSignal
from app.models.registration import Registration, RegistrationStatus
from app.models.table_match_player import TableMatchPlayer, TableMatchPlayerStatus
from app.models.user import AccountStatus, User
from app.models.user_role import UserRole, UserRoleType
from app.models.venue_booking_request import VenueBookingRequest
from app.services.event_access import EventForbiddenError
from app.services.gm_registration_service import decide_registration
from app.services.player_registration_service import (
    cancel_registration,
    request_registration,
)
from app.services.registration_common import RegistrationConflictError


def test_instant_join_updates_headcount_with_production_autoflush_disabled() -> None:
    factory, seed = build_lifecycle_factory(player_count=1)

    with factory() as session:
        user = session.get(User, seed.player_users[0].id)
        assert user is not None
        result = request_registration(session, user, seed.event_id)
        assert result.status == RegistrationStatus.CONFIRMED.value

    with factory() as session:
        booking = session.get(VenueBookingRequest, seed.booking_id)
        event = session.get(Event, seed.event_id)
        assert booking is not None and event is not None
        assert booking.expected_guests == 2
        assert event.status == EventStatus.FULL.value


def test_confirmed_cancellation_promotes_waitlist_with_autoflush_disabled() -> None:
    factory, seed = build_lifecycle_factory(player_count=2)

    with factory() as session:
        first = session.get(User, seed.player_users[0].id)
        second = session.get(User, seed.player_users[1].id)
        assert first is not None and second is not None
        first_result = request_registration(session, first, seed.event_id)
        second_result = request_registration(session, second, seed.event_id)
        assert first_result.status == RegistrationStatus.CONFIRMED.value
        assert second_result.status == RegistrationStatus.WAITLISTED.value

    with factory() as session:
        first = session.get(User, seed.player_users[0].id)
        assert first is not None
        cancel_registration(session, first, seed.event_id)

    with factory() as session:
        registrations = session.scalars(
            select(Registration)
            .where(Registration.event_id == seed.event_id)
            .order_by(Registration.requested_at, Registration.id)
        ).all()
        booking = session.get(VenueBookingRequest, seed.booking_id)
        event = session.get(Event, seed.event_id)
        assert [item.status for item in registrations] == [
            RegistrationStatus.CANCELLED.value,
            RegistrationStatus.CONFIRMED.value,
        ]
        assert booking is not None and booking.expected_guests == 2
        assert event is not None and event.status == EventStatus.FULL.value


@pytest.mark.parametrize(
    "account_status",
    [
        AccountStatus.RESTRICTED.value,
        AccountStatus.SUSPENDED.value,
        AccountStatus.BANNED.value,
    ],
)
def test_non_active_player_account_cannot_request_seat(account_status: str) -> None:
    factory, seed = build_lifecycle_factory(player_count=1)

    with factory() as session:
        user = session.get(User, seed.player_users[0].id)
        assert user is not None
        user.status = account_status
        session.commit()

    with factory() as session:
        user = session.get(User, seed.player_users[0].id)
        assert user is not None
        with pytest.raises(EventForbiddenError):
            request_registration(session, user, seed.event_id)


def test_removed_player_role_cannot_request_seat() -> None:
    factory, seed = build_lifecycle_factory(player_count=1)

    with factory() as session:
        session.execute(
            delete(UserRole).where(
                UserRole.user_id == seed.player_users[0].id,
                UserRole.role == UserRoleType.PLAYER.value,
            )
        )
        session.commit()

    with factory() as session:
        user = session.get(User, seed.player_users[0].id)
        assert user is not None
        with pytest.raises(EventForbiddenError):
            request_registration(session, user, seed.event_id)


def test_gm_cannot_confirm_player_after_demand_is_paused() -> None:
    factory, seed = build_lifecycle_factory(player_count=1)

    with factory() as session:
        event = session.get(Event, seed.event_id)
        player = session.get(User, seed.player_users[0].id)
        assert event is not None and player is not None
        event.join_mode = EventJoinMode.REQUEST_TO_JOIN.value
        session.commit()
        registration = request_registration(session, player, seed.event_id)
        assert registration.status == RegistrationStatus.REQUESTED.value

    with factory() as session:
        demand = session.get(PlayerDemandSignal, seed.player_demands[0].id)
        assert demand is not None
        demand.status = SignalStatus.PAUSED.value
        session.commit()

    with factory() as session:
        gm_user = session.get(User, seed.gm_user.id)
        registration = session.scalar(
            select(Registration).where(Registration.event_id == seed.event_id)
        )
        assert gm_user is not None and registration is not None
        with pytest.raises(RegistrationConflictError):
            decide_registration(
                session,
                gm_user,
                seed.event_id,
                registration.id,
                "confirm",
            )


def test_waitlist_skips_player_whose_match_state_is_no_longer_eligible() -> None:
    factory, seed = build_lifecycle_factory(player_count=3)

    with factory() as session:
        users = [session.get(User, item.id) for item in seed.player_users]
        assert all(user is not None for user in users)
        for user in users:
            assert user is not None
            request_registration(session, user, seed.event_id)

    with factory() as session:
        demand = session.get(PlayerDemandSignal, seed.player_demands[1].id)
        assert demand is not None
        match_player = session.scalar(
            select(TableMatchPlayer).where(
                TableMatchPlayer.table_match_id == seed.match_id,
                TableMatchPlayer.player_demand_signal_id == demand.id,
            )
        )
        assert match_player is not None
        match_player.status = TableMatchPlayerStatus.DECLINED.value
        session.commit()

    with factory() as session:
        first = session.get(User, seed.player_users[0].id)
        assert first is not None
        cancel_registration(session, first, seed.event_id)

    with factory() as session:
        second = session.get(PlayerDemandSignal, seed.player_demands[1].id)
        third = session.get(PlayerDemandSignal, seed.player_demands[2].id)
        assert second is not None and third is not None
        second_registration = session.scalar(
            select(Registration)
            .join(
                PlayerDemandSignal,
                PlayerDemandSignal.player_profile_id == Registration.player_profile_id,
            )
            .where(
                Registration.event_id == seed.event_id,
                PlayerDemandSignal.id == second.id,
            )
        )
        third_registration = session.scalar(
            select(Registration)
            .join(
                PlayerDemandSignal,
                PlayerDemandSignal.player_profile_id == Registration.player_profile_id,
            )
            .where(
                Registration.event_id == seed.event_id,
                PlayerDemandSignal.id == third.id,
            )
        )
        assert second_registration is not None and third_registration is not None
        assert second_registration.status == RegistrationStatus.WAITLISTED.value
        assert third_registration.status == RegistrationStatus.CONFIRMED.value
