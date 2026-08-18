"""Role-safe live Game Hub projection from production Event state."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.player_profile import PlayerProfile
from app.models.registration import Registration, RegistrationStatus
from app.models.user import User
from app.schemas.game_hub import (
    GameHubResponse,
    HubCapabilities,
    HubRegistrationQueueItem,
)
from app.services.event_reads import get_event_for_user
from app.services.game_hub_access import HubAccessContext, require_hub_access

CHANNEL_ORDER = (
    "table_announcement",
    "table_discussion",
    "gm_venue",
    "player_gm",
    "player_venue_question",
)
ROLE_POST_CHANNELS = {
    "gm": {"table_announcement", "table_discussion", "gm_venue", "player_gm"},
    "player": {"table_discussion", "player_gm", "player_venue_question"},
    "venue_manager": {"table_announcement", "gm_venue", "player_venue_question"},
}


def get_game_hub(session: Session, user: User, event_id: UUID) -> GameHubResponse:
    """Render one live Hub from durable Event/registration/booking state."""

    context = require_hub_access(session, user, event_id)
    event_response = get_event_for_user(session, user, event_id)
    allowed = set().union(*(ROLE_POST_CHANNELS[role] for role in context.viewer_roles))
    queue = _registration_queue(session, context) if "gm" in context.viewer_roles else []
    return GameHubResponse(
        event=event_response,
        capabilities=HubCapabilities(
            viewer_roles=list(context.viewer_roles),
            post_channels=[channel for channel in CHANNEL_ORDER if channel in allowed],
            can_manage_registrations="gm" in context.viewer_roles,
            can_manage_booking="venue_manager" in context.viewer_roles,
        ),
        registration_queue=queue,
    )


def _registration_queue(
    session: Session,
    context: HubAccessContext,
) -> list[HubRegistrationQueueItem]:
    rows = session.execute(
        select(Registration, User)
        .join(PlayerProfile, PlayerProfile.id == Registration.player_profile_id)
        .join(User, User.id == PlayerProfile.user_id)
        .where(
            Registration.event_id == context.event.id,
            Registration.status.in_(
                {
                    RegistrationStatus.REQUESTED.value,
                    RegistrationStatus.CONFIRMED.value,
                    RegistrationStatus.WAITLISTED.value,
                }
            ),
        )
        .order_by(Registration.requested_at, Registration.id)
    ).all()
    return [
        HubRegistrationQueueItem(
            registration_id=registration.id,
            display_name=user.display_name or "Player",
            status=registration.status,
            requested_at=registration.requested_at,
            expectations_acknowledged=(registration.expectations_acknowledged_at is not None),
        )
        for registration, user in rows
    ]


__all__ = ["CHANNEL_ORDER", "ROLE_POST_CHANNELS", "get_game_hub"]
