"""Tests for resource-specific Venue Manager authorization."""

from datetime import UTC, datetime
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.api.dependencies.venue_access import (
    VenueManagerRelationship,
    require_verified_venue_relationship,
)
from app.models.user import AccountStatus, User


def make_user() -> User:
    return User(
        id=uuid4(),
        auth_provider_user_id=f"provider-{uuid4()}",
        email=f"venue-manager-{uuid4()}@example.com",
        status=AccountStatus.ACTIVE.value,
    )


def test_verified_relationship_for_requested_venue_allows_operation() -> None:
    actor = make_user()
    venue_id = uuid4()
    relationship = VenueManagerRelationship(
        venue_id=venue_id,
        user_id=actor.id,
        verified_at=datetime.now(UTC),
    )

    assert require_verified_venue_relationship(actor, relationship, venue_id) is actor


def test_unverified_relationship_is_not_operational_permission() -> None:
    actor = make_user()
    venue_id = uuid4()
    relationship = VenueManagerRelationship(
        venue_id=venue_id,
        user_id=actor.id,
        verified_at=None,
    )

    with pytest.raises(HTTPException) as exc_info:
        require_verified_venue_relationship(actor, relationship, venue_id)

    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == "Venue Manager relationship is not verified."


def test_verified_relationship_for_another_venue_cannot_be_reused() -> None:
    actor = make_user()
    relationship = VenueManagerRelationship(
        venue_id=uuid4(),
        user_id=actor.id,
        verified_at=datetime.now(UTC),
    )

    with pytest.raises(HTTPException) as exc_info:
        require_verified_venue_relationship(actor, relationship, uuid4())

    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == "This account cannot operate the requested venue."


def test_verified_relationship_belonging_to_another_user_cannot_be_borrowed() -> None:
    actor = make_user()
    venue_id = uuid4()
    relationship = VenueManagerRelationship(
        venue_id=venue_id,
        user_id=uuid4(),
        verified_at=datetime.now(UTC),
    )

    with pytest.raises(HTTPException) as exc_info:
        require_verified_venue_relationship(actor, relationship, venue_id)

    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == "This account cannot operate the requested venue."
