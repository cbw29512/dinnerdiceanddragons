"""Server-side application-role dependencies backed by the DDD database."""

from typing import Annotated

from fastapi import Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies.current_user import require_active_user
from app.db.session import get_db_session
from app.models.user import User
from app.models.user_role import UserRole, UserRoleType


def _require_database_role(
    user: User,
    session: Session,
    required_role: UserRoleType,
) -> User:
    """Return ``user`` only when the durable DDD account holds ``required_role``."""

    role_exists = session.scalar(
        select(UserRole.user_id).where(
            UserRole.user_id == user.id,
            UserRole.role == required_role.value,
        )
    )
    if role_exists is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account does not have permission for this action.",
        )
    return user


def require_player(
    user: Annotated[User, Depends(require_active_user)],
    session: Annotated[Session, Depends(get_db_session)],
) -> User:
    """Require the active caller to hold the DDD Player role."""

    return _require_database_role(user, session, UserRoleType.PLAYER)


def require_dm(
    user: Annotated[User, Depends(require_active_user)],
    session: Annotated[Session, Depends(get_db_session)],
) -> User:
    """Require the active caller to hold the DDD GM/DM role."""

    return _require_database_role(user, session, UserRoleType.GM)


def require_venue_manager(
    user: Annotated[User, Depends(require_active_user)],
    session: Annotated[Session, Depends(get_db_session)],
) -> User:
    """Require the active caller to hold the general Venue Manager role.

    This proves only the global DDD role. Permission to operate a specific
    venue additionally requires a verified VenueManager relationship and is a
    separate authorization checkpoint in the production plan.
    """

    return _require_database_role(user, session, UserRoleType.VENUE_MANAGER)


def require_moderator(
    user: Annotated[User, Depends(require_active_user)],
    session: Annotated[Session, Depends(get_db_session)],
) -> User:
    """Require the active caller to hold the DDD Moderator role."""

    return _require_database_role(user, session, UserRoleType.MODERATOR)


def require_admin(
    user: Annotated[User, Depends(require_active_user)],
    session: Annotated[Session, Depends(get_db_session)],
) -> User:
    """Require the active caller to hold the DDD Admin role."""

    return _require_database_role(user, session, UserRoleType.ADMIN)
