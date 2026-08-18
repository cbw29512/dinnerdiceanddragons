"""Short-lived database queries for production Table Match candidates."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.availability_window import GMAvailabilityWindow, PlayerAvailabilityWindow
from app.models.gm_profile import GMProfile
from app.models.gm_supply_signal import GMSupplySignal
from app.models.matching_signal import SignalStatus
from app.models.player_demand_signal import PlayerDemandSignal
from app.models.player_profile import PlayerProfile
from app.models.recurring_availability_rule import RecurringAvailabilityRule
from app.models.venue import Venue
from app.models.venue_table_window import VenueTableWindow
from app.services.table_match_candidate_types import (
    GMCandidate,
    MatchCandidateSnapshot,
    PlayerCandidate,
    VenueCandidate,
)


def load_match_candidate_snapshot(session: Session) -> MatchCandidateSnapshot:
    """Load matching inputs into detached snapshots for computation outside the DB."""

    return MatchCandidateSnapshot(
        gms=tuple(_load_gms(session)),
        venues=tuple(_load_venues(session)),
        players=tuple(_load_players(session)),
    )


def _load_gms(session: Session) -> list[GMCandidate]:
    rows = session.execute(
        select(GMSupplySignal, GMProfile, RecurringAvailabilityRule)
        .join(GMProfile, GMProfile.id == GMSupplySignal.gm_profile_id)
        .join(GMAvailabilityWindow, GMAvailabilityWindow.gm_profile_id == GMProfile.id)
        .join(
            RecurringAvailabilityRule,
            RecurringAvailabilityRule.id == GMAvailabilityWindow.recurring_rule_id,
        )
        .where(
            GMSupplySignal.status == SignalStatus.ACTIVE.value,
            GMAvailabilityWindow.active.is_(True),
            RecurringAvailabilityRule.active.is_(True),
        )
        .order_by(GMSupplySignal.id, RecurringAvailabilityRule.id)
    ).all()
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
            rule=_copy_rule(rule),
        )
        for signal, profile, rule in rows
    ]


def _load_venues(session: Session) -> list[VenueCandidate]:
    rows = session.execute(
        select(VenueTableWindow, Venue, RecurringAvailabilityRule)
        .join(Venue, Venue.id == VenueTableWindow.venue_id)
        .join(
            RecurringAvailabilityRule,
            RecurringAvailabilityRule.id == VenueTableWindow.recurring_rule_id,
        )
        .where(
            VenueTableWindow.active.is_(True),
            RecurringAvailabilityRule.active.is_(True),
            Venue.latitude.is_not(None),
            Venue.longitude.is_not(None),
        )
        .order_by(VenueTableWindow.id)
    ).all()
    return [
        VenueCandidate(
            window_id=window.id,
            venue_id=venue.id,
            table_count=window.table_count,
            max_people_per_table=window.max_people_per_table,
            active=venue.active,
            verified=venue.verified,
            latitude=float(venue.latitude),
            longitude=float(venue.longitude),
            rule=_copy_rule(rule),
        )
        for window, venue, rule in rows
        if venue.latitude is not None and venue.longitude is not None
    ]


def _load_players(session: Session) -> list[PlayerCandidate]:
    rows = session.execute(
        select(PlayerDemandSignal, PlayerProfile, RecurringAvailabilityRule)
        .join(PlayerProfile, PlayerProfile.id == PlayerDemandSignal.player_profile_id)
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
            PlayerAvailabilityWindow.active.is_(True),
            RecurringAvailabilityRule.active.is_(True),
        )
        .order_by(PlayerDemandSignal.id, RecurringAvailabilityRule.id)
    ).all()
    return [
        PlayerCandidate(
            demand_id=signal.id,
            player_profile_id=profile.id,
            game_system_id=signal.game_system_id,
            preferred_format=signal.preferred_format,
            status=signal.status,
            postal_code=profile.postal_code,
            travel_radius_miles=profile.travel_radius_miles,
            rule=_copy_rule(rule),
        )
        for signal, profile, rule in rows
    ]


def _copy_rule(rule: RecurringAvailabilityRule) -> RecurringAvailabilityRule:
    return RecurringAvailabilityRule(
        id=rule.id,
        day_of_week=rule.day_of_week,
        start_time=rule.start_time,
        end_time=rule.end_time,
        pattern_type=rule.pattern_type,
        week_interval=rule.week_interval,
        anchor_date=rule.anchor_date,
        monthly_ordinal=rule.monthly_ordinal,
        month_interval=rule.month_interval,
        timezone=rule.timezone,
        starts_on=rule.starts_on,
        ends_on=rule.ends_on,
        active=rule.active,
    )


__all__ = ["load_match_candidate_snapshot"]
