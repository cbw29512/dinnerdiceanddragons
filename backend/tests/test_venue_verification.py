"""Service tests for Admin-controlled Venue verification."""

from uuid import UUID

import pytest
from onboarding_test_support import build_onboarding_client
from sqlalchemy import select
from venue_onboarding_test_data import venue_payload

from app.models.privileged_audit_event import PrivilegedAuditEvent
from app.models.user import User
from app.models.user_role import UserRole, UserRoleType
from app.models.venue import Venue, VenueManager
from app.services.venue_verification import (
    VenueVerificationConflictError,
    VenueVerificationNotFoundError,
    VenueVerificationPersistenceError,
    VenueVerificationValidationError,
    verify_initial_venue_claim,
)


@pytest.fixture()
def verification_context():
    client, factory, engine = build_onboarding_client()
    try:
        yield client, factory
    finally:
        client.close()
        engine.dispose()


def auth(token: str = "alice-token") -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def create_claim(client, token: str = "alice-token") -> UUID:
    response = client.post(
        "/api/v1/onboarding/venue",
        json=venue_payload(),
        headers=auth(token),
    )
    assert response.status_code == 201, response.text
    return UUID(response.json()["venue_id"])


def grant_admin(session, user_id: UUID) -> User:
    user = session.get(User, user_id)
    assert user is not None
    session.add(
        UserRole(
            user_id=user.id,
            role=UserRoleType.ADMIN.value,
        )
    )
    session.commit()
    return user


def test_admin_can_verify_initial_venue_claim_atomically(verification_context) -> None:
    client, factory = verification_context
    venue_id = create_claim(client)

    with factory() as session:
        manager = session.scalar(select(VenueManager).where(VenueManager.venue_id == venue_id))
        assert manager is not None

        admin = grant_admin(session, manager.user_id)

        venue = verify_initial_venue_claim(
            session,
            admin,
            venue_id=venue_id,
            venue_manager_id=manager.id,
            latitude=34.1954,
            longitude=-79.7626,
        )

        assert venue.verified is True
        assert venue.latitude == pytest.approx(34.1954)
        assert venue.longitude == pytest.approx(-79.7626)

    with factory() as session:
        stored_venue = session.get(Venue, venue_id)
        stored_manager = session.scalar(
            select(VenueManager).where(VenueManager.venue_id == venue_id)
        )
        audit = session.scalar(
            select(PrivilegedAuditEvent).where(
                PrivilegedAuditEvent.target_type == "venue",
                PrivilegedAuditEvent.target_id == str(venue_id),
                PrivilegedAuditEvent.action == "venue.verify_initial_claim",
            )
        )

        assert stored_venue is not None
        assert stored_venue.verified is True
        assert stored_venue.latitude == pytest.approx(34.1954)
        assert stored_venue.longitude == pytest.approx(-79.7626)

        assert stored_manager is not None
        assert stored_manager.verified_at is not None

        assert audit is not None
        assert audit.actor_role == UserRoleType.ADMIN.value
        assert audit.outcome == "success"
        assert audit.reason_code == "initial_claim_approved"


def test_mismatched_venue_manager_claim_is_rejected(verification_context) -> None:
    client, factory = verification_context
    alice_venue_id = create_claim(client, "alice-token")

    bob_payload = venue_payload()
    bob_payload["name"] = "Bob's Verification Venue"
    bob_payload["address_line1"] = "456 Verification Way"

    bob_response = client.post(
        "/api/v1/onboarding/venue",
        json=bob_payload,
        headers=auth("bob-token"),
    )
    assert bob_response.status_code == 201, bob_response.text
    bob_venue_id = UUID(bob_response.json()["venue_id"])

    with factory() as session:
        alice_manager = session.scalar(
            select(VenueManager).where(VenueManager.venue_id == alice_venue_id)
        )
        bob_manager = session.scalar(
            select(VenueManager).where(VenueManager.venue_id == bob_venue_id)
        )
        assert alice_manager is not None
        assert bob_manager is not None

        admin = grant_admin(session, alice_manager.user_id)

        with pytest.raises(VenueVerificationNotFoundError):
            verify_initial_venue_claim(
                session,
                admin,
                venue_id=alice_venue_id,
                venue_manager_id=bob_manager.id,
                latitude=34.1954,
                longitude=-79.7626,
            )


def test_already_verified_venue_is_rejected(verification_context) -> None:
    client, factory = verification_context
    venue_id = create_claim(client)

    with factory() as session:
        manager = session.scalar(select(VenueManager).where(VenueManager.venue_id == venue_id))
        venue = session.get(Venue, venue_id)
        assert manager is not None
        assert venue is not None

        admin = grant_admin(session, manager.user_id)
        venue.verified = True
        session.commit()

        with pytest.raises(VenueVerificationConflictError):
            verify_initial_venue_claim(
                session,
                admin,
                venue_id=venue_id,
                venue_manager_id=manager.id,
                latitude=34.1954,
                longitude=-79.7626,
            )


@pytest.mark.parametrize(
    ("latitude", "longitude"),
    [
        (91.0, -79.7626),
        (-91.0, -79.7626),
        (34.1954, 181.0),
        (34.1954, -181.0),
    ],
)
def test_invalid_coordinates_are_rejected(
    verification_context,
    latitude: float,
    longitude: float,
) -> None:
    client, factory = verification_context
    venue_id = create_claim(client)

    with factory() as session:
        manager = session.scalar(select(VenueManager).where(VenueManager.venue_id == venue_id))
        assert manager is not None

        admin = grant_admin(session, manager.user_id)

        with pytest.raises(VenueVerificationValidationError):
            verify_initial_venue_claim(
                session,
                admin,
                venue_id=venue_id,
                venue_manager_id=manager.id,
                latitude=latitude,
                longitude=longitude,
            )


def test_non_admin_cannot_complete_venue_verification(verification_context) -> None:
    client, factory = verification_context
    venue_id = create_claim(client)

    with factory() as session:
        manager = session.scalar(select(VenueManager).where(VenueManager.venue_id == venue_id))
        assert manager is not None

        user = session.get(User, manager.user_id)
        assert user is not None

        with pytest.raises(VenueVerificationPersistenceError):
            verify_initial_venue_claim(
                session,
                user,
                venue_id=venue_id,
                venue_manager_id=manager.id,
                latitude=34.1954,
                longitude=-79.7626,
            )

    with factory() as session:
        venue = session.get(Venue, venue_id)
        manager = session.scalar(select(VenueManager).where(VenueManager.venue_id == venue_id))
        audit_count = len(session.scalars(select(PrivilegedAuditEvent)).all())

        assert venue is not None
        assert venue.verified is False
        assert venue.latitude is None
        assert venue.longitude is None

        assert manager is not None
        assert manager.verified_at is None

        assert audit_count == 0
