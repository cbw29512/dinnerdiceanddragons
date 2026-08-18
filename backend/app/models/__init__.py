"""Production ORM models.

Import every ORM model here so Alembic can load all registered table metadata
from one place.
"""

from app.db.base import Base
from app.models.availability_window import GMAvailabilityWindow, PlayerAvailabilityWindow
from app.models.event import Event, EventJoinMode, EventStatus, EventType
from app.models.game_series import GameSeries
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
from app.models.match_explanation import MatchCriterionResult, MatchExplanation
from app.models.matching_signal import SignalStatus
from app.models.message import Message, MessageChannelType, MessageModerationStatus
from app.models.player_demand_signal import PlayerDemandSignal
from app.models.player_profile import PlayerProfile, PreferredGameFormat
from app.models.player_system_experience import PlayerComfortLevel, PlayerSystemExperience
from app.models.postal_code_centroid import PostalCodeCentroid
from app.models.privileged_audit_event import PrivilegedAuditEvent
from app.models.recurring_availability_rule import (
    AvailabilityDay,
    AvailabilityPatternType,
    MonthlyOrdinal,
    RecurringAvailabilityRule,
)
from app.models.registration import Registration, RegistrationStatus
from app.models.table_expectations import TableExpectations
from app.models.table_match import TableMatch, TableMatchStatus
from app.models.table_match_player import TableMatchPlayer, TableMatchPlayerStatus
from app.models.user import AccountStatus, User
from app.models.user_role import UserRole, UserRoleType
from app.models.venue import Venue, VenueManager, VenueManagerRole, VenueType
from app.models.venue_booking_request import VenueBookingRequest, VenueBookingStatus
from app.models.venue_table_window import VenueTableWindow

metadata = Base.metadata

__all__ = [
    "AccountStatus",
    "AvailabilityDay",
    "AvailabilityPatternType",
    "Event",
    "EventJoinMode",
    "EventStatus",
    "EventType",
    "GameSeries",
    "GameSystem",
    "GMAvailabilityWindow",
    "GMComfortLevel",
    "GMGameFormat",
    "GMProfile",
    "GMSupplySignal",
    "GMSystemExperience",
    "GMSystemFormat",
    "MatchCriterionResult",
    "MatchExplanation",
    "Message",
    "MessageChannelType",
    "MessageModerationStatus",
    "MonthlyOrdinal",
    "PlayerAvailabilityWindow",
    "PlayerComfortLevel",
    "PlayerDemandSignal",
    "PlayerProfile",
    "PlayerSystemExperience",
    "PostalCodeCentroid",
    "PreferredGameFormat",
    "PreferredPlayerExperience",
    "PrivilegedAuditEvent",
    "RecurringAvailabilityRule",
    "Registration",
    "RegistrationStatus",
    "SignalStatus",
    "TableExpectations",
    "TableMatch",
    "TableMatchPlayer",
    "TableMatchPlayerStatus",
    "TableMatchStatus",
    "User",
    "UserRole",
    "UserRoleType",
    "Venue",
    "VenueBookingRequest",
    "VenueBookingStatus",
    "VenueManager",
    "VenueManagerRole",
    "VenueTableWindow",
    "VenueType",
    "metadata",
]
