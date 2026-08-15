"""Safely map a verified Supabase identity to one durable DDD User."""

import logging
from collections.abc import Mapping
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.user import AccountStatus, User

LOGGER = logging.getLogger(__name__)


class IdentityClaimsError(ValueError):
    """Raised when verified JWT claims are insufficient for DDD identity mapping."""


class IdentityLinkConflict(RuntimeError):
    """Raised when DDD refuses an ambiguous or unsafe identity link."""


def _canonical_email(value: object) -> str:
    """Normalize provider email for stable DDD uniqueness comparisons."""

    if not isinstance(value, str) or not value.strip():
        raise IdentityClaimsError("Authenticated identity is missing an email address.")
    return value.strip().casefold()


def _identity_from_claims(claims: Mapping[str, Any]) -> tuple[str, str]:
    """Extract only security-relevant immutable/provider-verified identity fields."""

    subject = claims.get("sub")
    if not isinstance(subject, str) or not subject.strip():
        raise IdentityClaimsError("Authenticated identity is missing a subject.")
    if claims.get("role") != "authenticated":
        raise IdentityClaimsError("Authenticated identity has an unexpected role.")
    if claims.get("is_anonymous") is True:
        raise IdentityClaimsError("Anonymous identities cannot create DDD accounts.")

    return subject.strip(), _canonical_email(claims.get("email"))


def _find_by_subject(session: Session, subject: str) -> User | None:
    return session.scalar(select(User).where(User.auth_provider_user_id == subject))


def _find_by_email(session: Session, email: str) -> User | None:
    return session.scalar(select(User).where(User.email == email))


def _apply_verified_login(session: Session, user: User, email: str, now: datetime) -> User:
    """Refresh trusted identity data without undoing administrative restrictions."""

    if user.email != email:
        email_owner = _find_by_email(session, email)
        if email_owner is not None and email_owner.id != user.id:
            raise IdentityLinkConflict("Verified email is already bound to another DDD identity.")
        user.email = email

    if user.email_verified_at is None:
        user.email_verified_at = now
    user.last_login_at = now

    # A verified provider login completes the pending-verification state, but it
    # must never reactivate a restricted, suspended, or banned DDD account.
    if user.status == AccountStatus.PENDING_VERIFICATION.value:
        user.status = AccountStatus.ACTIVE.value

    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        raise IdentityLinkConflict("DDD could not safely update the verified identity.") from exc
    return user


def get_or_create_verified_user(session: Session, claims: Mapping[str, Any]) -> User:
    """Return exactly one durable DDD User for a verified Supabase identity.

    The Supabase ``sub`` claim is the binding key. Email is synchronized only
    after the token has been cryptographically verified. A matching email owned
    by a different provider subject is treated as a conflict rather than being
    silently re-linked, preventing account takeover during provider churn.
    """

    subject, email = _identity_from_claims(claims)
    now = datetime.now(UTC)

    existing = _find_by_subject(session, subject)
    if existing is not None:
        return _apply_verified_login(session, existing, email, now)

    email_owner = _find_by_email(session, email)
    if email_owner is not None:
        raise IdentityLinkConflict("Verified email is already bound to another DDD identity.")

    user = User(
        auth_provider_user_id=subject,
        email=email,
        email_verified_at=now,
        status=AccountStatus.ACTIVE.value,
        last_login_at=now,
    )
    session.add(user)

    try:
        session.commit()
        LOGGER.info("Created durable DDD user %s from verified Supabase identity", user.id)
        return user
    except IntegrityError as exc:
        # A concurrent first request may have inserted the same provider user.
        # Re-read by immutable provider subject and converge on that one record.
        session.rollback()
        concurrent_user = _find_by_subject(session, subject)
        if concurrent_user is not None:
            return _apply_verified_login(session, concurrent_user, email, now)

        if _find_by_email(session, email) is not None:
            raise IdentityLinkConflict(
                "Verified email is already bound to another DDD identity."
            ) from exc
        raise
