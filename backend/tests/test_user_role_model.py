"""Schema-level tests for application roles on one durable User."""

from app.models.user_role import UserRole, UserRoleType


def test_user_role_values_match_identity_schema() -> None:
    assert {role.value for role in UserRoleType} == {
        "player",
        "gm",
        "venue_manager",
        "moderator",
        "admin",
    }


def test_user_role_uses_composite_primary_key() -> None:
    primary_key_columns = {column.name for column in UserRole.__table__.primary_key.columns}

    assert primary_key_columns == {"user_id", "role"}


def test_user_role_verification_is_optional() -> None:
    assert UserRole.__table__.c.verified_at.nullable is True
