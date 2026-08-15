"""Tests for DDD account-status participation enforcement."""

import pytest
from fastapi import HTTPException

from app.api.dependencies.current_user import require_active_user
from app.models.user import AccountStatus, User


def make_user(status: AccountStatus) -> User:
    return User(
        auth_provider_user_id=f"provider-{status.value}",
        email=f"{status.value}@example.com",
        status=status.value,
    )


def test_active_account_can_enter_protected_participation() -> None:
    user = make_user(AccountStatus.ACTIVE)

    assert require_active_user(user) is user


@pytest.mark.parametrize(
    "account_status",
    [
        AccountStatus.PENDING_VERIFICATION,
        AccountStatus.RESTRICTED,
        AccountStatus.SUSPENDED,
        AccountStatus.BANNED,
    ],
)
def test_non_active_account_cannot_enter_protected_participation(
    account_status: AccountStatus,
) -> None:
    user = make_user(account_status)

    with pytest.raises(HTTPException) as exc_info:
        require_active_user(user)

    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == "Account is not permitted to participate."
