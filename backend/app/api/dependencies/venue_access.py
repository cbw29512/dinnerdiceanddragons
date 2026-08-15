"""Authorization policy for Venue Manager operations.

Step 1 defines and tests the policy without prematurely creating Venue models;
Step 2 persistence will load these facts from the DDD database before calling
this helper.
"""

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from fastapi import HTTPException, status

from app.models.user import User


@dataclass(frozen=True, slots=True)
class VenueManagerRelationship:
    """Server-loaded authorization facts for one User ↔ Venue relationship."""

    venue_id: UUID
    user_id: UUID
    verified_at: datetime | None


def require_verified_venue_relationship(
    actor: User,
    relationship: VenueManagerRelationship,
    requested_venue_id: UUID,
) -> User:
    """Require the caller's verified relationship to the requested venue.

    The caller must already have passed active-account and global Venue Manager
    role checks. This policy adds the resource-specific relationship boundary.
    ``relationship`` must come from server-side persistence, never request JSON.
    """

    if relationship.user_id != actor.id or relationship.venue_id != requested_venue_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account cannot operate the requested venue.",
        )

    if relationship.verified_at is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Venue Manager relationship is not verified.",
        )

    return actor
