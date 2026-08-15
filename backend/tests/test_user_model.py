"""Schema-level tests for the durable Dinner, Dice & Dragons User identity."""

from sqlalchemy import Uuid

from app.models.user import AccountStatus, User


def test_user_id_is_uuid_primary_key() -> None:
    id_column = User.__table__.c.id

    assert id_column.primary_key is True
    assert id_column.nullable is False
    assert isinstance(id_column.type, Uuid)


def test_user_model_carries_one_durable_identity_record() -> None:
    assert User.__tablename__ == "users"
    assert set(User.__table__.c.keys()) == {
        "id",
        "auth_provider_user_id",
        "email",
        "email_verified_at",
        "display_name",
        "display_name_normalized",
        "status",
        "created_at",
        "updated_at",
        "last_login_at",
    }


def test_account_status_values_match_identity_design() -> None:
    assert {status.value for status in AccountStatus} == {
        "pending_verification",
        "active",
        "restricted",
        "suspended",
        "banned",
    }
