"""Readiness contracts for critical production dependencies."""

from fastapi.testclient import TestClient
import pytest
from sqlalchemy import create_engine
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.routes import health as health_routes
from app.db.session import get_db_session
from app.main import app
from app.services.readiness import ReadinessCheckError, check_database_readiness


def _sqlite_factory() -> tuple[sessionmaker[Session], object]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    return sessionmaker(bind=engine, class_=Session), engine


def test_database_readiness_accepts_working_session() -> None:
    factory, engine = _sqlite_factory()
    try:
        with factory() as session:
            check_database_readiness(session)
    finally:
        engine.dispose()


def test_database_readiness_collapses_database_exception() -> None:
    class FailingSession:
        def scalar(self, _statement):
            raise OperationalError(
                "SELECT 1",
                {},
                RuntimeError("postgres://secret-user:secret-pass@private-db"),
            )

    with pytest.raises(ReadinessCheckError) as blocked:
        check_database_readiness(FailingSession())  # type: ignore[arg-type]

    assert str(blocked.value) == "Database dependency is not ready."
    assert "secret-pass" not in str(blocked.value)


def test_ready_endpoint_reports_database_ready() -> None:
    factory, engine = _sqlite_factory()

    def override_db_session():
        with factory() as session:
            yield session

    app.dependency_overrides[get_db_session] = override_db_session
    try:
        with TestClient(app) as client:
            response = client.get("/api/v1/ready")
    finally:
        app.dependency_overrides.pop(get_db_session, None)
        engine.dispose()

    assert response.status_code == 200
    assert response.json() == {
        "status": "ready",
        "service": "dinner-dice-and-dragons-api",
        "dependencies": {"database": "ok"},
    }


def test_ready_endpoint_fails_closed_without_breaking_liveness(monkeypatch) -> None:
    def fail_readiness(_session) -> None:
        raise ReadinessCheckError("private database details must not escape")

    monkeypatch.setattr(health_routes, "check_database_readiness", fail_readiness)
    factory, engine = _sqlite_factory()

    def override_db_session():
        with factory() as session:
            yield session

    app.dependency_overrides[get_db_session] = override_db_session
    try:
        with TestClient(app) as client:
            readiness = client.get("/api/v1/ready")
            liveness = client.get("/api/v1/health")
    finally:
        app.dependency_overrides.pop(get_db_session, None)
        engine.dispose()

    assert readiness.status_code == 503
    assert readiness.json() == {"detail": "Service is not ready."}
    assert "private database" not in readiness.text
    assert liveness.status_code == 200
