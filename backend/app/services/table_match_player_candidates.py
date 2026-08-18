"""Bounded Player candidate loading for production Table Match."""

import logging

from sqlalchemy import exists, select
from sqlalchemy.orm import Session

from app.models.availability_window import PlayerAvailabilityWindow
from app.models.game_system import GameSystem
from app.models.matching_signal import SignalStatus
from app.models.matching_signal_availability import PlayerDemandAvailabilityWindow
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
    """Load active Player candidates using signal-owned time windows when available."""

    try:
        specific_rows = session.execute(
            _base_query()
            .join(
                PlayerDemandAvailabilityWindow,
                PlayerDemandAvailabilityWindow.player_demand_signal_id == PlayerDemandSignal.id,
            )
            .join(
                RecurringAvailabilityRule,
                RecurringAvailabilityRule.id == PlayerDemandAvailabilityWindow.recurring_rule_id,
            )
            .where(
                PlayerDemandAvailabilityWindow.active.is_(True),
                RecurringAvailabilityRule.active.is_(True),
            )
            .order_by(PlayerDemandSignal.id, RecurringAvailabilityRule.id)
            .limit(MAX_MATCH_CANDIDATE_ROWS_PER_KIND + 1)
        ).all()

        # Preserve pre-migration signal behavior until those signals are replaced.
        legacy_rows = session.execute(
            _base_query()
            .join(
                PlayerAvailabilityWindow,
                PlayerAvailabilityWindow.player_profile_id == PlayerProfile.id,
            )
            .join(
                RecurringAvailabilityRule,
                RecurringAvailabilityRule.id == PlayerAvailabilityWindow.recurring_rule_id,
            )
            .where(
                ~exists(
                    select(PlayerDemandAvailabilityWindow.id).where(
                        PlayerDemandAvailabilityWindow.player_demand_signal_id
                        == PlayerDemandSignal.id
                    )
                ),
                PlayerAvailabilityWindow.active.is_(True),
                RecurringAvailabilityRule.active.is_(True),
            )
            .order_by(PlayerDemandSignal.id, RecurringAvailabilityRule.id)
            .limit(MAX_MATCH_CANDIDATE_ROWS_PER_KIND + 1)
        ).all()

        rows = sorted(
            [*specific_rows, *legacy_rows],
            key=lambda row: (str(row[0].id), str(row[2].id)),
        )
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


def _base_query():
    """Apply identity/system eligibility once for both availability ownership modes."""

    return (
        select(PlayerDemandSignal, PlayerProfile, RecurringAvailabilityRule)
        .select_from(PlayerDemandSignal)
        .join(PlayerProfile, PlayerProfile.id == PlayerDemandSignal.player_profile_id)
        .join(User, User.id == PlayerProfile.user_id)
        .join(UserRole, UserRole.user_id == User.id)
        .join(GameSystem, GameSystem.id == PlayerDemandSignal.game_system_id)
        .where(
            PlayerDemandSignal.status == SignalStatus.ACTIVE.value,
            User.status == AccountStatus.ACTIVE.value,
            UserRole.role == UserRoleType.PLAYER.value,
            GameSystem.active.is_(True),
        )
    )


__all__ = ["load_player_candidates"]
