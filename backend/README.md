# Dinner, Dice & Dragons — Production API

This directory is the production FastAPI backend. It is intentionally separate from the GitHub Pages validation site while production identity, persistence, authorization, and workflows are built and proven.

## Current scope

Implemented:

- FastAPI application factory.
- Versioned `/api/v1` route namespace.
- Dependency-free `GET /api/v1/health` liveness endpoint.
- Typed environment/settings model with secret redaction.
- SQLAlchemy + Psycopg PostgreSQL engine/session layer.
- Alembic migration infrastructure.
- Docker image for the FastAPI service.
- Docker Compose development stack with PostgreSQL 18 + API health checks.
- CI smoke test that builds the stack, waits for healthy containers, and verifies the HTTP health endpoint.
- Automated backend tests in the repository quality workflow.

Not implemented yet:

- first production identity migration (`users` / `user_roles`)
- Supabase JWT authentication
- DDD User/UserRole application models
- production domain APIs

The authoritative implementation order is `../docs/PRODUCTION_MVP_PLAN.md`.

## Fastest local start — Docker

From the repository root:

```bash
docker compose up --build
```

Then open:

- API health: `http://127.0.0.1:8000/api/v1/health`
- OpenAPI docs: `http://127.0.0.1:8000/docs`

Stop the stack with:

```bash
docker compose down
```

To also delete the local PostgreSQL development data volume:

```bash
docker compose down --volumes
```

## Local Python development

Requires Python 3.13 or 3.14 and a reachable PostgreSQL instance for database-backed work.

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows PowerShell: .venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -e ".[dev]"
uvicorn app.main:app --reload
```

Copy `backend/.env.example` to `backend/.env` when local environment overrides are needed. Never commit real credentials.

## Tests

```bash
cd backend
pytest
```

Alembic configuration can be checked without a live database:

```bash
cd backend
alembic -c alembic.ini heads
alembic -c alembic.ini upgrade head --sql
```

## Architecture rule

Authentication identifies the caller. Authorization remains DDD application policy enforced server-side. Never authorize a protected operation merely because the browser supplied a user ID, role, venue ID, game ID, or other ownership claim.
