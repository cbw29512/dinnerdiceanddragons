"""Attack tests proving client-supplied identity/role data never authorizes actions."""

from collections.abc import Iterator
from typing import Annotated
from uuid import UUID

from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient
from pydantic import BaseModel
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.dependencies.current_user import get_current_user
from app.api.dependencies.roles import require_dm
from app.db.session import get_db_session
from app.identity.user_linking import get_or_create_verified_user
from app.models.user import AccountStatus, User
from app.models.user_role import UserRole, UserRoleType


class ForgedAuthorizationRequest(BaseModel):
    """Fields an untrusted client might try to use to impersonate someone."""

    user_id: UUID
    role: str


def make_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    User.__table__.create(engine)
    UserRole.__table__.create(engine)
    return sessionmaker(bind=engine, class_=Session, expire_on_commit=False)


def create_user(
    factory: sessionmaker[Session],
    email: str,
    roles: tuple[UserRoleType, ...],
) -> User:
    with factory() as session:
        user = User(
            auth_provider_user_id=f"provider-{email}",
            email=email,
            status=AccountStatus.ACTIVE.value,
        )
        session.add(user)
        session.flush()
        for role in roles:
            session.add(UserRole(user_id=user.id, role=role.value))
        session.commit()
        return user


def make_dm_action_client(
    factory: sessionmaker[Session],
    authenticated_actor: User,
) -> TestClient:
    application = FastAPI()

    @application.post("/dm-action")
    def dm_action(
        payload: ForgedAuthorizationRequest,
        actor: Annotated[User, Depends(require_dm)],
    ) -> dict[str, str]:
        # The payload is deliberately ignored for authorization. The actor is
        # derived from verified authentication + the durable DDD database.
        return {
            "authorized_actor_id": str(actor.id),
            "requested_user_id": str(payload.user_id),
            "requested_role": payload.role,
        }

    application.dependency_overrides[get_current_user] = lambda: authenticated_actor

    def override_db_session() -> Iterator[Session]:
        session = factory()
        try:
            yield session
        finally:
            session.close()

    application.dependency_overrides[get_db_session] = override_db_session
    return TestClient(application)


def test_client_cannot_borrow_another_users_id_or_role_to_gain_dm_access() -> None:
    factory = make_factory()
    attacker = create_user(factory, "attacker@example.com", (UserRoleType.PLAYER,))
    victim = create_user(factory, "victim@example.com", (UserRoleType.GM, UserRoleType.ADMIN))
    client = make_dm_action_client(factory, attacker)

    response = client.post(
        "/dm-action",
        json={"user_id": str(victim.id), "role": UserRoleType.GM.value},
    )

    assert response.status_code == 403
    assert response.json() == {
        "detail": "This account does not have permission for this action."
    }


def test_authorized_action_uses_authenticated_actor_not_requested_user_id() -> None:
    factory = make_factory()
    actor = create_user(factory, "dm@example.com", (UserRoleType.GM,))
    other_user = create_user(factory, "admin@example.com", (UserRoleType.ADMIN,))
    client = make_dm_action_client(factory, actor)

    response = client.post(
        "/dm-action",
        json={"user_id": str(other_user.id), "role": UserRoleType.ADMIN.value},
    )

    assert response.status_code == 200
    assert response.json() == {
        "authorized_actor_id": str(actor.id),
        "requested_user_id": str(other_user.id),
        "requested_role": UserRoleType.ADMIN.value,
    }
    assert response.json()["authorized_actor_id"] != response.json()["requested_user_id"]


def test_provider_or_user_metadata_role_claims_do_not_create_ddd_roles() -> None:
    factory = make_factory()
    with factory() as session:
        user = get_or_create_verified_user(
            session,
            {
                "sub": "33333333-3333-3333-3333-333333333333",
                "email": "metadata@example.com",
                "role": "authenticated",
                "is_anonymous": False,
                "app_metadata": {
                    "ddd_role": UserRoleType.ADMIN.value,
                    "roles": [UserRoleType.ADMIN.value, UserRoleType.MODERATOR.value],
                },
                "user_metadata": {
                    "role": UserRoleType.ADMIN.value,
                    "user_id": "someone-else",
                },
            },
        )

        role_count = session.scalar(
            select(func.count()).select_from(UserRole).where(UserRole.user_id == user.id)
        )

        assert role_count == 0
