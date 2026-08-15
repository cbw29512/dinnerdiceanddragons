"""Schema-level tests for the durable Dinner, Dice & Dragons User identity."""

from sqlalchemy import DateTime, Uuid

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


def test_user_timestamp_columns_have_expected_model_semantics() -> None:
    created_at = User.__table__.c.created_at
    updated_at = User.__table__.c.updated_at
    last_login_at = User.__table__.c.last_login_at

    assert isinstance(created_at.type, DateTime)
    assert created_at.type.timezone is True
    assert created_at.nullable is False
    assert created_at.server_default is not None

    assert isinstance(updated_at.type, DateTime)
    assert updated_at.type.timezone is True
    assert updated_at.nullable is False
    assert updated_at.server_default is not None
    assert updated_at.onupdate is not None

    assert isinstance(last_login_at.type, DateTime)
    assert last_login_at.type.timezone is True
    assert last_login_at.nullable is True
    assert last_login_at.server_default is None
