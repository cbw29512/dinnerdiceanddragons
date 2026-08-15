"""Unit tests for safe verified Supabase identity mapping."""

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.identity.user_linking import (
    IdentityClaimsError,
    IdentityLinkConflict,
    get_or_create_verified_user,
)
from app.models.user import AccountStatus, User

SUBJECT = "11111111-1111-1111-1111-111111111111"


def make_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    User.__table__.create(engine)
    return sessionmaker(bind=engine, class_=Session, expire_on_commit=False)


def claims(subject: str = SUBJECT, email: str = "Player@Example.COM") -> dict[str, object]:
    return {
        "sub": subject,
        "email": email,
        "role": "authenticated",
        "is_anonymous": False,
    }


def test_first_verified_login_creates_active_durable_user() -> None:
    factory = make_factory()
    with factory() as session:
        user = get_or_create_verified_user(session, claims())

        assert user.auth_provider_user_id == SUBJECT
        assert user.email == "player@example.com"
        assert user.status == AccountStatus.ACTIVE.value
        assert user.email_verified_at is not None
        assert user.last_login_at is not None


def test_repeated_verified_login_is_idempotent() -> None:
    factory = make_factory()
    with factory() as session:
        first = get_or_create_verified_user(session, claims())
        first_id = first.id
        second = get_or_create_verified_user(session, claims())

        assert second.id == first_id
        assert len(session.scalars(select(User)).all()) == 1


def test_same_provider_subject_can_sync_new_verified_email() -> None:
    factory = make_factory()
    with factory() as session:
        first = get_or_create_verified_user(session, claims())
        first_id = first.id
        second = get_or_create_verified_user(
            session,
            claims(email="New.Address@Example.com"),
        )

        assert second.id == first_id
        assert second.email == "new.address@example.com"


def test_email_collision_with_different_subject_is_never_auto_linked() -> None:
    factory = make_factory()
    with factory() as session:
        get_or_create_verified_user(session, claims())

        try:
            get_or_create_verified_user(
                session,
                claims(
                    subject="22222222-2222-2222-2222-222222222222",
                    email="player@example.com",
                ),
            )
        except IdentityLinkConflict:
            pass
        else:
            raise AssertionError("Expected conflicting provider subject to be rejected")

        assert len(session.scalars(select(User)).all()) == 1


def test_restricted_account_is_not_reactivated_by_login() -> None:
    factory = make_factory()
    with factory() as session:
        user = get_or_create_verified_user(session, claims())
        user.status = AccountStatus.SUSPENDED.value
        session.commit()

        returned = get_or_create_verified_user(session, claims())

        assert returned.status == AccountStatus.SUSPENDED.value


def test_incomplete_or_anonymous_identity_is_rejected() -> None:
    factory = make_factory()
    with factory() as session:
        bad_claims = [
            {"email": "player@example.com", "role": "authenticated"},
            {"sub": SUBJECT, "role": "authenticated"},
            {"sub": SUBJECT, "email": "player@example.com", "role": "service_role"},
            {
                "sub": SUBJECT,
                "email": "player@example.com",
                "role": "authenticated",
                "is_anonymous": True,
            },
        ]

        for payload in bad_claims:
            try:
                get_or_create_verified_user(session, payload)
            except IdentityClaimsError:
                continue
            raise AssertionError(f"Expected claims to be rejected: {payload}")
