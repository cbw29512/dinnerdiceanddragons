"""Bounded Player candidate loading for production Table Match."""

import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.availability_window import PlayerAvailabilityWindow
from app.models.game_system import GameSystem
from app.models.matching_signal import SignalStatus
from app.models.player_demand_signal import PlayerDemandSignal
from app.models.player_profile import PlayerProfile
from app.models.recurring_availability_rule import RecurringAvailabilityRule
from app.models.user import AccountStatus, User
from app.models.user_role import UserRole, UserRoleType
from app.services.table_match_candidate_mapping import (
    copy_recurring_rule,
    require_bounded_candidate_rows,
)
from app.services.table_match_candidate_types import PlayerCandidate
from app.services.table_match_engine_policy import MAX_MATCH_CANDIDATE_ROWS_PER_KIND

LOGGER = logging.getLogger(__name__)


def load_player_candidates(session: Session) -> list[PlayerCandidate]:
    """Load active Player candidates without allowing an unbounded result set."""

    try:
        rows = session.execute(
            select(PlayerDemandSignal, PlayerProfile, RecurringAvailabilityRule)
            .join(PlayerProfile, PlayerProfile.id == PlayerDemandSignal.player_profile_id)
            .join(User, User.id == PlayerProfile.user_id)
            .join(UserRole, UserRole.user_id == User.id)
            .join(GameSystem, GameSystem.id == PlayerDemandSignal.game_system_id)
            .join(
                PlayerAvailabilityWindow,
                PlayerAvailabilityWindow.player_profile_id == PlayerProfile.id,
            )
            .join(
                RecurringAvailabilityRule,
                RecurringAvailabilityRule.id == PlayerAvailabilityWindow.recurring_rule_id,
            )
            .where(
                PlayerDemandSignal.status == SignalStatus.ACTIVE.value,
                User.status == AccountStatus.ACTIVE.value,
                UserRole.role == UserRoleType.PLAYER.value,
                GameSystem.active.is_(True),
                PlayerAvailabilityWindow.active.is_(True),
                RecurringAvailabilityRule.active.is_(True),
            )
            .order_by(PlayerDemandSignal.id, RecurringAvailabilityRule.id)
            .limit(MAX_MATCH_CANDIDATE_ROWS_PER_KIND + 1)
        ).all()
        bounded_rows = require_bounded_candidate_rows(rows, kind="Player")
        return [
            PlayerCandidate(
                demand_id=signal.id,
                player_profile_id=profile.id,
                game_system_id=signal.game_system_id,
                preferred_format=signal.preferred_format,
                status=signal.status,
                postal_code=profile.postal_code,
                travel_radius_miles=profile.travel_radius_miles,
                rule=copy_recurring_rule(rule),
            )
            for signal, profile, rule in bounded_rows
        ]
    except Exception:
        LOGGER.exception("Failed to load bounded Player match candidates")
        raise


__all__ = ["load_player_candidates"]
