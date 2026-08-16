"""Production ORM models.

Import every ORM model here so Alembic can load all registered table metadata
from one place.
"""

from app.db.base import Base
from app.models.availability_window import GMAvailabilityWindow, PlayerAvailabilityWindow
from app.models.game_system import GameSystem
from app.models.gm_profile import GMProfile
from app.models.gm_supply_signal import GMSupplySignal
from app.models.gm_system_experience import (
    GMComfortLevel,
    GMGameFormat,
    GMSystemExperience,
    GMSystemFormat,
    PreferredPlayerExperience,
)
from app.models.matching_signal import SignalStatus
from app.models.player_demand_signal import PlayerDemandSignal
from app.models.player_profile import PlayerProfile, PreferredGameFormat
from app.models.player_system_experience import PlayerComfortLevel, PlayerSystemExperience
from app.models.privileged_audit_event import PrivilegedAuditEvent
from app.models.recurring_availability_rule import (
    AvailabilityDay,
    AvailabilityPatternType,
    MonthlyOrdinal,
    RecurringAvailabilityRule,
)
from app.models.user import AccountStatus, User
from app.models.user_role import UserRole, UserRoleType
from app.models.venue import Venue, VenueManager, VenueManagerRole, VenueType
from app.models.venue_table_window import VenueTableWindow

metadata = Base.metadata

__all__ = [
    "AccountStatus",
    "AvailabilityDay",
    "AvailabilityPatternType",
    "GameSystem",
    "GMAvailabilityWindow",
    "GMComfortLevel",
    "GMGameFormat",
    "GMProfile",
    "GMSupplySignal",
    "GMSystemExperience",
    "GMSystemFormat",
    "MonthlyOrdinal",
    "PlayerAvailabilityWindow",
    "PlayerComfortLevel",
    "PlayerDemandSignal",
    "PlayerProfile",
    "PlayerSystemExperience",
    "PreferredGameFormat",
    "PreferredPlayerExperience",
    "PrivilegedAuditEvent",
    "RecurringAvailabilityRule",
    "SignalStatus",
    "User",
    "UserRole",
    "UserRoleType",
    "Venue",
    "VenueManager",
    "VenueManagerRole",
    "VenueTableWindow",
    "VenueType",
    "metadata",
]
