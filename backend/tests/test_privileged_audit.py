"""Tests for durable Moderator/Admin audit evidence."""

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.audit.service import record_privileged_action
from app.models.privileged_audit_event import PrivilegedAuditEvent
from app.models.user import AccountStatus, User
from app.models.user_role import UserRole, UserRoleType


def make_session() -> Session:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    User.__table__.create(engine)
    UserRole.__table__.create(engine)
    PrivilegedAuditEvent.__table__.create(engine)
    return Session(engine)


def add_user(session: Session, *, role: UserRoleType, status: AccountStatus) -> User:
    user = User(
        auth_provider_user_id=f"provider-{role.value}-{status.value}",
        email=f"{role.value}-{status.value}@example.com",
        status=status.value,
    )
    session.add(user)
    session.flush()
    session.add(UserRole(user_id=user.id, role=role.value))
    session.flush()
    return user


@pytest.mark.parametrize("role", [UserRoleType.MODERATOR, UserRoleType.ADMIN])
def test_active_privileged_role_records_narrow_audit_event(role: UserRoleType) -> None:
    with make_session() as session:
        actor = add_user(session, role=role, status=AccountStatus.ACTIVE)

        event = record_privileged_action(
            session,
            actor_user_id=actor.id,
            actor_role=role.value,
            action="account.status.change",
            target_type="user",
            target_id="target-user-id",
            outcome="success",
            reason_code="policy_violation",
        )
        session.commit()

        stored = session.scalar(
            select(PrivilegedAuditEvent).where(PrivilegedAuditEvent.id == event.id)
        )
        assert stored is not None
        assert stored.actor_user_id == actor.id
        assert stored.actor_role == role.value
        assert stored.action == "account.status.change"
        assert stored.target_type == "user"
        assert stored.target_id == "target-user-id"
        assert stored.outcome == "success"
        assert stored.reason_code == "policy_violation"
        assert stored.created_at is not None


def test_non_privileged_role_cannot_manufacture_audit_authority() -> None:
    with make_session() as session:
        actor = add_user(session, role=UserRoleType.PLAYER, status=AccountStatus.ACTIVE)

        with pytest.raises(PermissionError):
            record_privileged_action(
                session,
                actor_user_id=actor.id,
                actor_role=UserRoleType.ADMIN.value,
                action="account.status.change",
                target_type="user",
            )

        assert session.scalar(select(PrivilegedAuditEvent)) is None


def test_suspended_admin_cannot_record_privileged_action() -> None:
    with make_session() as session:
        actor = add_user(session, role=UserRoleType.ADMIN, status=AccountStatus.SUSPENDED)

        with pytest.raises(PermissionError):
            record_privileged_action(
                session,
                actor_user_id=actor.id,
                actor_role=UserRoleType.ADMIN.value,
                action="account.status.change",
                target_type="user",
            )


def test_unknown_outcome_is_rejected() -> None:
    with make_session() as session:
        actor = add_user(session, role=UserRoleType.ADMIN, status=AccountStatus.ACTIVE)

        with pytest.raises(ValueError):
            record_privileged_action(
                session,
                actor_user_id=actor.id,
                actor_role=UserRoleType.ADMIN.value,
                action="account.status.change",
                target_type="user",
                outcome="maybe",
            )
