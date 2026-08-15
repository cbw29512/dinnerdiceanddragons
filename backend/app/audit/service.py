"""Server-side recorder for privileged Moderator/Admin actions."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.privileged_audit_event import PrivilegedAuditEvent
from app.models.user import AccountStatus, User
from app.models.user_role import UserRole, UserRoleType

_PRIVILEGED_ROLES = {
    UserRoleType.MODERATOR.value,
    UserRoleType.ADMIN.value,
}
_VALID_OUTCOMES = {"success", "denied", "error"}


def record_privileged_action(
    session: Session,
    *,
    actor_user_id: UUID,
    actor_role: str,
    action: str,
    target_type: str,
    target_id: str | None = None,
    outcome: str = "success",
    reason_code: str | None = None,
) -> PrivilegedAuditEvent:
    """Persist audit evidence after re-verifying active privileged authority.

    Only narrow action metadata is stored. Raw request bodies, credentials,
    tokens, message contents, and other sensitive payloads must not be passed
    to this function.
    """

    if actor_role not in _PRIVILEGED_ROLES:
        raise PermissionError("A Moderator or Admin role is required for audit recording")
    if outcome not in _VALID_OUTCOMES:
        raise ValueError("Unsupported privileged audit outcome")

    role = session.scalar(
        select(UserRole)
        .join(User, User.id == UserRole.user_id)
        .where(
            UserRole.user_id == actor_user_id,
            UserRole.role == actor_role,
            User.status == AccountStatus.ACTIVE.value,
        )
    )
    if role is None:
        raise PermissionError("The actor does not hold the active privileged role")

    event = PrivilegedAuditEvent(
        actor_user_id=actor_user_id,
        actor_role=actor_role,
        action=action,
        target_type=target_type,
        target_id=target_id,
        outcome=outcome,
        reason_code=reason_code,
    )
    session.add(event)
    session.flush()
    return event
