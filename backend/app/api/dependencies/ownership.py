"""Resource ownership helpers for DDD domain authorization.

These helpers consume ownership facts loaded from the server-side database.
They never accept a client-asserted actor identity as the authorization source.
Domain persistence models arrive in later production steps; keeping the policy
pure here lets those APIs share one tested ownership rule when they are added.
"""

from uuid import UUID

from fastapi import HTTPException, status

from app.models.user import User


def _require_owner(
    actor: User,
    owner_user_id: UUID,
    *,
    resource_label: str,
) -> User:
    """Return ``actor`` only when a server-loaded owner ID matches the caller."""

    if actor.id != owner_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"This account cannot manage the requested {resource_label}.",
        )
    return actor


def require_profile_owner(actor: User, profile_user_id: UUID) -> User:
    """Require ownership of a PlayerProfile or GMProfile via its ``user_id``."""

    return _require_owner(actor, profile_user_id, resource_label="profile")


def require_game_owner(actor: User, gm_user_id: UUID) -> User:
    """Require ownership of a GameSeries/Event via its GM profile's User ID."""

    return _require_owner(actor, gm_user_id, resource_label="game")


def require_registration_owner(actor: User, player_user_id: UUID) -> User:
    """Require ownership of a Registration via its Player profile's User ID."""

    return _require_owner(actor, player_user_id, resource_label="registration")


def require_venue_manager_identity(actor: User, manager_user_id: UUID) -> User:
    """Require the caller to match the server-loaded VenueManager User ID.

    This checks relationship identity only. The next authorization checkpoint
    additionally requires that the VenueManager relationship is verified before
    any venue operation is permitted.
    """

    return _require_owner(actor, manager_user_id, resource_label="venue")


def require_message_sender(actor: User, sender_user_id: UUID) -> User:
    """Require ownership of a mutable Message via its ``sender_user_id``.

    Event/channel membership and message visibility are separate authorization
    concerns implemented with the persistent Game Hub in a later production step.
    """

    return _require_owner(actor, sender_user_id, resource_label="message")
