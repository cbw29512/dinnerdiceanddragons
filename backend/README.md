# Dinner, Dice & Dragons — Production API

This directory is the production FastAPI backend. It is intentionally separate from the GitHub Pages validation site while production identity, persistence, authorization, and workflows are built and proven.

## Current scope

Implemented:

- FastAPI application factory.
- Versioned `/api/v1` route namespace.
- Dependency-free `GET /api/v1/health` liveness endpoint.
- Automated health-endpoint test.
- CI installation and test execution.

Not implemented yet:

- environment/settings model
- PostgreSQL connection
- Alembic migrations
- Docker runtime
- Supabase JWT authentication
- DDD User/UserRole models
- production domain APIs

The authoritative implementation order is `../docs/PRODUCTION_MVP_PLAN.md`.

## Local development

Requires Python 3.13 or 3.14.

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows PowerShell: .venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -e ".[dev]"
uvicorn app.main:app --reload
```

Then open:

- API health: `http://127.0.0.1:8000/api/v1/health`
- OpenAPI docs: `http://127.0.0.1:8000/docs`

## Tests

```bash
pytest
```

## Architecture rule

Authentication identifies the caller. Authorization remains DDD application policy enforced server-side. Never authorize a protected operation merely because the browser supplied a user ID, role, venue ID, game ID, or other ownership claim.
