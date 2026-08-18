"""Request-correlation and structured logging privacy contracts."""

import json
import logging
from uuid import UUID

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.request_context import get_request_id
from app.middleware.request_observability import RequestObservabilityMiddleware

LOGGER_NAME = "app.http"


def _observed_app() -> FastAPI:
    application = FastAPI()
    application.add_middleware(RequestObservabilityMiddleware)

    @application.get("/context")
    def context() -> dict[str, str | None]:
        return {"request_id": get_request_id()}

    @application.post("/body")
    def body() -> dict[str, bool]:
        return {"ok": True}

    @application.get("/explode")
    def explode() -> None:
        raise RuntimeError("SECRET_EXCEPTION_MESSAGE")

    return application


def _events(caplog) -> list[dict[str, object]]:
    return [
        json.loads(record.getMessage())
        for record in caplog.records
        if record.name == LOGGER_NAME and record.getMessage().startswith("{")
    ]


def test_server_request_id_controls_response_context_and_completion_log(caplog) -> None:
    application = _observed_app()
    client_supplied = "attacker-controlled-request-id"
    caplog.set_level(logging.INFO, logger=LOGGER_NAME)

    with TestClient(application) as client:
        response = client.get(
            "/context?token=QUERY_SECRET",
            headers={
                "X-Request-ID": client_supplied,
                "Authorization": "Bearer AUTH_SECRET",
            },
        )

    request_id = response.headers["x-request-id"]
    UUID(request_id)
    assert request_id != client_supplied
    assert response.json() == {"request_id": request_id}

    completion = [event for event in _events(caplog) if event["event"] == "http_request_complete"]
    assert len(completion) == 1
    assert completion[0]["request_id"] == request_id
    assert completion[0]["method"] == "GET"
    assert completion[0]["path"] == "/context"
    assert completion[0]["status_code"] == 200

    rendered = "\n".join(record.getMessage() for record in caplog.records if record.name == LOGGER_NAME)
    assert "QUERY_SECRET" not in rendered
    assert "AUTH_SECRET" not in rendered
    assert client_supplied not in rendered


def test_request_body_content_is_not_logged(caplog) -> None:
    application = _observed_app()
    caplog.set_level(logging.INFO, logger=LOGGER_NAME)

    with TestClient(application) as client:
        response = client.post(
            "/body?debug=QUERY_BODY_SECRET",
            json={"message": "BODY_SECRET"},
        )

    assert response.status_code == 200
    rendered = "\n".join(record.getMessage() for record in caplog.records if record.name == LOGGER_NAME)
    assert "BODY_SECRET" not in rendered
    assert "QUERY_BODY_SECRET" not in rendered


def test_unhandled_exception_keeps_correlation_without_logging_message(caplog) -> None:
    application = _observed_app()
    caplog.set_level(logging.INFO, logger=LOGGER_NAME)

    with TestClient(application, raise_server_exceptions=False) as client:
        response = client.get("/explode")

    request_id = response.headers["x-request-id"]
    UUID(request_id)
    assert response.status_code == 500
    assert response.json() == {"detail": "Internal server error."}

    events = _events(caplog)
    failures = [event for event in events if event["event"] == "http_request_unhandled_exception"]
    completions = [event for event in events if event["event"] == "http_request_complete"]
    assert len(failures) == 1
    assert len(completions) == 1
    assert failures[0]["request_id"] == request_id
    assert failures[0]["error_type"] == "RuntimeError"
    assert failures[0]["status_code"] == 500
    assert completions[0]["request_id"] == request_id
    assert completions[0]["status_code"] == 500

    rendered = "\n".join(record.getMessage() for record in caplog.records if record.name == LOGGER_NAME)
    assert "SECRET_EXCEPTION_MESSAGE" not in rendered
