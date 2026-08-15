"""Constraint-level tests for the complete durable identity schema."""

from app.models.user import User
from app.models.user_role import UserRole


def test_users_model_marks_identity_columns_unique() -> None:
    assert User.__table__.c.auth_provider_user_id.unique is True
    assert User.__table__.c.email.unique is True
    assert User.__table__.c.display_name_normalized.unique is True


def test_user_roles_foreign_key_cascades_when_user_is_deleted() -> None:
    foreign_keys = list(UserRole.__table__.c.user_id.foreign_keys)

    assert len(foreign_keys) == 1
    assert foreign_keys[0].target_fullname == "users.id"
    assert foreign_keys[0].ondelete == "CASCADE"
