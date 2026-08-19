"""Bounded GM candidate loading for production Table Match."""

import logging

from sqlalchemy import exists, select
from sqlalchemy.orm import Session

from app.models.availability_window import GMAvailabilityWindow
from app.models.game_system import GameSystem
from app.models.gm_profile import GMProfile
from app.models.gm_supply_signal import GMSupplySignal
from app.models.matching_signal import SignalStatus
from app.models.matching_signal_availability import GMSupplyAvailabilityWindow
from app.models.recurring_availability_rule import RecurringAvailabilityRule
from app.models.user import AccountStatus, User
from app.models.user_role import UserRole, UserRoleType
from app.services.table_match_candidate_mapping import (
    copy_recurring_rule,
    require_bounded_candidate_rows,
)
from app.services.table_match_candidate_types import GMCandidate
from app.services.table_match_engine_policy import MAX_MATCH_CANDIDATE_ROWS_PER_KIND

LOGGER = logging.getLogger(__name__)


def load_gm_candidates(session: Session) -> list[GMCandidate]:
    """Load active GM candidates using signal-owned time windows when available."""

    try:
        specific_rows = session.execute(
            _base_query()
            .join(
                GMSupplyAvailabilityWindow,
                GMSupplyAvailabilityWindow.gm_supply_signal_id == GMSupplySignal.id,
            )
            .join(
                RecurringAvailabilityRule,
                RecurringAvailabilityRule.id == GMSupplyAvailabilityWindow.recurring_rule_id,
            )
            .where(
                GMSupplyAvailabilityWindow.active.is_(True),
                RecurringAvailabilityRule.active.is_(True),
            )
            .order_by(GMSupplySignal.id, RecurringAvailabilityRule.id)
            .limit(MAX_MATCH_CANDIDATE_ROWS_PER_KIND + 1)
        ).all()

        # Backward compatibility: signals created before signal-owned availability
        # continue to use profile availability until they are replaced/edited.
        legacy_rows = session.execute(
            _base_query()
            .join(GMAvailabilityWindow, GMAvailabilityWindow.gm_profile_id == GMProfile.id)
            .join(
                RecurringAvailabilityRule,
                RecurringAvailabilityRule.id == GMAvailabilityWindow.recurring_rule_id,
            )
            .where(
                ~exists(
                    select(GMSupplyAvailabilityWindow.id).where(
                        GMSupplyAvailabilityWindow.gm_supply_signal_id == GMSupplySignal.id
                    )
                ),
                GMAvailabilityWindow.active.is_(True),
                RecurringAvailabilityRule.active.is_(True),
            )
            .order_by(GMSupplySignal.id, RecurringAvailabilityRule.id)
            .limit(MAX_MATCH_CANDIDATE_ROWS_PER_KIND + 1)
        ).all()

        rows = sorted(
            [*specific_rows, *legacy_rows],
            key=lambda row: (str(row[0].id), str(row[2].id)),
        )
        bounded_rows = require_bounded_candidate_rows(rows, kind="GM")
        return [
            GMCandidate(
                signal_id=signal.id,
                game_system_id=signal.game_system_id,
                preferred_format=signal.preferred_format,
                minimum_players=signal.minimum_players,
                maximum_players=signal.maximum_players,
                status=signal.status,
                postal_code=profile.postal_code,
                travel_radius_miles=profile.travel_radius_miles,
                rule=copy_recurring_rule(rule),
            )
            for signal, profile, rule in bounded_rows
        ]
    except Exception:
        LOGGER.exception("Failed to load bounded GM match candidates")
        raise


def _base_query():
    """Apply identity/system eligibility once for both availability ownership modes."""

    return (
        select(GMSupplySignal, GMProfile, RecurringAvailabilityRule)
        .select_from(GMSupplySignal)
        .join(GMProfile, GMProfile.id == GMSupplySignal.gm_profile_id)
        .join(User, User.id == GMProfile.user_id)
        .join(UserRole, UserRole.user_id == User.id)
        .join(GameSystem, GameSystem.id == GMSupplySignal.game_system_id)
        .where(
            GMSupplySignal.status == SignalStatus.ACTIVE.value,
            User.status == AccountStatus.ACTIVE.value,
            UserRole.role == UserRoleType.GM.value,
            GameSystem.active.is_(True),
        )
    )


__all__ = ["load_gm_candidates"]
