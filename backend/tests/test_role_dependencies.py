"""Tests for server-side DDD role dependencies."""

from collections.abc import Callable, Iterator
from typing import Annotated

import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.dependencies.current_user import get_current_user
from app.api.dependencies.roles import (
    require_admin,
    require_dm,
    require_moderator,
    require_player,
    require_venue_manager,
)
from app.db.session import get_db_session
from app.models.user import AccountStatus, User
from app.models.user_role import UserRole, UserRoleType

RoleDependency = Callable[..., User]
ROLE_CASES: tuple[tuple[str, UserRoleType, RoleDependency], ...] = (
    ("player", UserRoleType.PLAYER, require_player),
    ("dm", UserRoleType.GM, require_dm),
    ("venue-manager", UserRoleType.VENUE_MANAGER, require_venue_manager),
    ("moderator", UserRoleType.MODERATOR, require_moderator),
    ("admin", UserRoleType.ADMIN, require_admin),
)


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
    *,
    roles: tuple[UserRoleType, ...] = (),
    status: AccountStatus = AccountStatus.ACTIVE,
) -> User:
    with factory() as session:
        user = User(
            auth_provider_user_id=f"provider-{status.value}-{len(roles)}-{id(factory)}",
            email=f"user-{status.value}-{len(roles)}-{id(factory)}@example.com",
            status=status.value,
        )
        session.add(user)
        session.flush()
        for role in roles:
            session.add(UserRole(user_id=user.id, role=role.value))
        session.commit()
        return user


def make_client(
    factory: sessionmaker[Session],
    user: User,
) -> TestClient:
    application = FastAPI()

    for path, _role, dependency in ROLE_CASES:

        def make_endpoint(role_dependency: RoleDependency):
            def endpoint(
                authorized_user: Annotated[User, Depends(role_dependency)],
            ) -> dict[str, str]:
                return {"ddd_user_id": str(authorized_user.id)}

            return endpoint

        application.add_api_route(
            f"/{path}",
            make_endpoint(dependency),
            methods=["GET"],
        )

    application.dependency_overrides[get_current_user] = lambda: user

    def override_db_session() -> Iterator[Session]:
        session = factory()
        try:
            yield session
        finally:
            session.close()

    application.dependency_overrides[get_db_session] = override_db_session
    return TestClient(application)


@pytest.mark.parametrize("path,role,_dependency", ROLE_CASES)
def test_matching_database_role_allows_access(
    path: str,
    role: UserRoleType,
    _dependency: RoleDependency,
) -> None:
    factory = make_factory()
    user = create_user(factory, roles=(role,))
    client = make_client(factory, user)

    response = client.get(f"/{path}")

    assert response.status_code == 200
    assert response.json() == {"ddd_user_id": str(user.id)}


@pytest.mark.parametrize("path,_role,_dependency", ROLE_CASES)
def test_missing_database_role_is_forbidden(
    path: str,
    _role: UserRoleType,
    _dependency: RoleDependency,
) -> None:
    factory = make_factory()
    user = create_user(factory)
    client = make_client(factory, user)

    response = client.get(f"/{path}")

    assert response.status_code == 403
    assert response.json() == {"detail": "This account does not have permission for this action."}


def test_one_user_can_hold_multiple_independent_roles() -> None:
    factory = make_factory()
    user = create_user(factory, roles=(UserRoleType.PLAYER, UserRoleType.GM))
    client = make_client(factory, user)

    assert client.get("/player").status_code == 200
    assert client.get("/dm").status_code == 200
    assert client.get("/venue-manager").status_code == 403


def test_admin_role_does_not_implicitly_grant_other_roles() -> None:
    factory = make_factory()
    user = create_user(factory, roles=(UserRoleType.ADMIN,))
    client = make_client(factory, user)

    assert client.get("/admin").status_code == 200
    assert client.get("/moderator").status_code == 403
    assert client.get("/player").status_code == 403
    assert client.get("/dm").status_code == 403
    assert client.get("/venue-manager").status_code == 403


def test_non_active_account_is_forbidden_even_when_role_exists() -> None:
    factory = make_factory()
    user = create_user(
        factory,
        roles=(UserRoleType.GM,),
        status=AccountStatus.SUSPENDED,
    )
    client = make_client(factory, user)

    response = client.get("/dm")

    assert response.status_code == 403
    assert response.json() == {"detail": "Account is not permitted to participate."}
