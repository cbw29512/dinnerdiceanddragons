"""Short-lived session boundary for distributed rate-limit enforcement."""

import logging

from app.core.config import Settings
from app.db.session import get_session_factory
from app.security.rate_limit_policy import (
    RateLimitDecision,
    RateLimitPolicy,
    hash_rate_limit_subject,
)
from app.security.rate_limit_store import consume_rate_limit

LOGGER = logging.getLogger(__name__)


def enforce_subject_rate_limit(
    settings: Settings,
    *,
    policy: RateLimitPolicy,
    subject_kind: str,
    subject: str,
) -> RateLimitDecision:
    """Consume one shared allowance in an isolated transaction."""

    session = get_session_factory()()
    try:
        secret = settings.rate_limit_secret()
        subject_hash = hash_rate_limit_subject(secret, subject_kind, subject)
        decision = consume_rate_limit(
            session,
            policy=policy,
            subject_hash=subject_hash,
            limit=policy.limit_for(subject_kind),
        )
        session.commit()
        return decision
    except Exception:
        try:
            session.rollback()
        except Exception:
            LOGGER.exception("Rate-limit transaction rollback failed")
        LOGGER.exception(
            "Rate-limit enforcement failed",
            extra={"policy": policy.name, "subject_kind": subject_kind},
        )
        raise
    finally:
        session.close()
