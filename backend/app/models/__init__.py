"""Production ORM models.

Import every ORM model here so Alembic can load all registered table metadata
from one place.
"""

from app.db.base import Base
from app.models.privileged_audit_event import PrivilegedAuditEvent
from app.models.user import AccountStatus, User
from app.models.user_role import UserRole, UserRoleType

metadata = Base.metadata

__all__ = [
    "AccountStatus",
    "PrivilegedAuditEvent",
    "User",
    "UserRole",
    "UserRoleType",
    "metadata",
]
