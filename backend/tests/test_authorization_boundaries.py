"""Integrated negative tests for cross-user authorization boundaries."""

from datetime import UTC, datetime
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.api.dependencies.ownership import (
    require_game_owner,
    require_message_sender,
    require_profile_owner,
    require_registration_owner,
    require_venue_manager_identity,
)
from app.api.dependencies.roles import require_dm, require_player, require_venue_manager
from app.api.dependencies.venue_access import (
    VenueManagerRelationship,
    require_verified_venue_relationship,
)
from app.models.user import AccountStatus, User
from app.models.user_role import UserRole, UserRoleType


def add_user(
    session: Session,
    *,
    email_prefix: str,
    roles: tuple[UserRoleType, ...],
) -> User:
    user = User(
        auth_provider_user_id=f"provider-{email_prefix}-{uuid4()}",
        email=f"{email_prefix}-{uuid4()}@example.com",
        status=AccountStatus.ACTIVE.value,
    )
    session.add(user)
    session.flush()
    for role in roles:
        session.add(UserRole(user_id=user.id, role=role.value))
    session.flush()
    return user


def assert_forbidden(callable_) -> None:
    with pytest.raises(HTTPException) as exc_info:
        callable_()
    assert exc_info.value.status_code == 403


def assert_cross_user_resource_isolation(actor: User, other_user_id: UUID) -> None:
    """Attack every currently defined resource-owner boundary."""

    for helper in (
        require_profile_owner,
        require_game_owner,
        require_registration_owner,
        require_venue_manager_identity,
        require_message_sender,
    ):
        assert_forbidden(lambda helper=helper: helper(actor, other_user_id))


def test_two_distinct_users_cannot_borrow_roles_resources_or_venue_authority() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    User.__table__.create(engine)
    UserRole.__table__.create(engine)

    with Session(engine) as session:
        alice = add_user(
            session,
            email_prefix="alice",
            roles=(UserRoleType.PLAYER, UserRoleType.GM),
        )
        bob = add_user(
            session,
            email_prefix="bob",
            roles=(UserRoleType.VENUE_MANAGER,),
        )

        assert alice.id != bob.id

        # Each account receives only its own durable database roles.
        assert require_player(alice, session) is alice
        assert require_dm(alice, session) is alice
        assert require_venue_manager(bob, session) is bob
        assert_forbidden(lambda: require_venue_manager(alice, session))
        assert_forbidden(lambda: require_dm(bob, session))
        assert_forbidden(lambda: require_player(bob, session))

        # Ownership cannot be crossed in either direction.
        assert_cross_user_resource_isolation(alice, bob.id)
        assert_cross_user_resource_isolation(bob, alice.id)

        # Bob's verified relationship works only for Bob and its exact venue.
        venue_id = uuid4()
        relationship = VenueManagerRelationship(
            venue_id=venue_id,
            user_id=bob.id,
            verified_at=datetime.now(UTC),
        )
        assert require_verified_venue_relationship(bob, relationship, venue_id) is bob
        assert_forbidden(
            lambda: require_verified_venue_relationship(alice, relationship, venue_id)
        )
        assert_forbidden(
            lambda: require_verified_venue_relationship(bob, relationship, uuid4())
        )

        # Same-user ownership still works; isolation is not an accidental deny-all.
        assert require_profile_owner(alice, alice.id) is alice
        assert require_game_owner(alice, alice.id) is alice
        assert require_registration_owner(bob, bob.id) is bob
        assert require_message_sender(bob, bob.id) is bob
