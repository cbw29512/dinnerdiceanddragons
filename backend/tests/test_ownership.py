"""Tests for reusable server-side DDD resource ownership policy."""

from collections.abc import Callable
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException

from app.api.dependencies.ownership import (
    require_game_owner,
    require_message_sender,
    require_profile_owner,
    require_registration_owner,
    require_venue_manager_identity,
)
from app.models.user import AccountStatus, User

OwnershipHelper = Callable[[User, UUID], User]
OWNERSHIP_CASES: tuple[tuple[str, OwnershipHelper], ...] = (
    ("profile", require_profile_owner),
    ("game", require_game_owner),
    ("registration", require_registration_owner),
    ("venue", require_venue_manager_identity),
    ("message", require_message_sender),
)


def make_user() -> User:
    return User(
        id=uuid4(),
        auth_provider_user_id=f"provider-{uuid4()}",
        email=f"owner-{uuid4()}@example.com",
        status=AccountStatus.ACTIVE.value,
    )


@pytest.mark.parametrize("_label,helper", OWNERSHIP_CASES)
def test_authenticated_owner_can_manage_own_resource(
    _label: str,
    helper: OwnershipHelper,
) -> None:
    actor = make_user()

    assert helper(actor, actor.id) is actor


@pytest.mark.parametrize("label,helper", OWNERSHIP_CASES)
def test_cross_user_resource_access_is_forbidden(
    label: str,
    helper: OwnershipHelper,
) -> None:
    actor = make_user()
    other_user_id = uuid4()

    with pytest.raises(HTTPException) as exc_info:
        helper(actor, other_user_id)

    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == f"This account cannot manage the requested {label}."


def test_venue_identity_helper_does_not_claim_relationship_verification() -> None:
    """Venue ownership identity is intentionally only half of venue authorization."""

    actor = make_user()

    # Matching the VenueManager user identity succeeds here. The next checklist
    # checkpoint must still verify VenueManager.verified_at before operations.
    assert require_venue_manager_identity(actor, actor.id) is actor
