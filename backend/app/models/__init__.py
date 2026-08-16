"""Production ORM models.

Import every ORM model here so Alembic can load all registered table metadata
from one place.
"""

from app.db.base import Base
from app.models.game_system import GameSystem
from app.models.gm_profile import GMProfile
from app.models.gm_system_experience import (
    GMComfortLevel,
    GMGameFormat,
    GMSystemExperience,
    GMSystemFormat,
    PreferredPlayerExperience,
)
from app.models.player_profile import PlayerProfile, PreferredGameFormat
from app.models.player_system_experience import PlayerComfortLevel, PlayerSystemExperience
from app.models.privileged_audit_event import PrivilegedAuditEvent
from app.models.user import AccountStatus, User
from app.models.user_role import UserRole, UserRoleType
from app.models.venue import Venue, VenueManager, VenueManagerRole, VenueType

metadata = Base.metadata

__all__ = [
    "AccountStatus",
    "GameSystem",
    "GMComfortLevel",
    "GMGameFormat",
    "GMProfile",
    "GMSystemExperience",
    "GMSystemFormat",
    "PlayerComfortLevel",
    "PlayerProfile",
    "PlayerSystemExperience",
    "PreferredGameFormat",
    "PreferredPlayerExperience",
    "PrivilegedAuditEvent",
    "User",
    "UserRole",
    "UserRoleType",
    "Venue",
    "VenueManager",
    "VenueManagerRole",
    "VenueType",
    "metadata",
]
