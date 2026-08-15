"""Constraint-level tests for the complete durable identity schema."""

from sqlalchemy import UniqueConstraint

from app.models.user import User
from app.models.user_role import UserRole


def test_users_table_has_all_identity_uniqueness_constraints() -> None:
    unique_constraint_names = {
        constraint.name
        for constraint in User.__table__.constraints
        if isinstance(constraint, UniqueConstraint)
    }

    assert unique_constraint_names == {
        "uq_users_auth_provider_user_id",
        "uq_users_display_name_normalized",
        "uq_users_email",
    }


def test_user_roles_foreign_key_cascades_when_user_is_deleted() -> None:
    foreign_keys = list(UserRole.__table__.c.user_id.foreign_keys)

    assert len(foreign_keys) == 1
    assert foreign_keys[0].target_fullname == "users.id"
    assert foreign_keys[0].ondelete == "CASCADE"
