# Dinner, Dice & Dragons — Production API

This directory is the production FastAPI backend. It is intentionally separate from the GitHub Pages validation site while production identity, persistence, authorization, and workflows are built and proven.

## Current scope

Implemented:

- FastAPI application factory and versioned `/api/v1` route namespace.
- Dependency-free `GET /api/v1/health` liveness endpoint.
- Typed environment/settings model with secret redaction.
- SQLAlchemy + Psycopg PostgreSQL engine/session layer.
- Alembic migration infrastructure.
- Durable `users` and `user_roles` identity schema with stable DDD IDs.
- Unique normalized display-name policy, account statuses, and multi-role identity support.
- Docker image and Docker Compose development stack with PostgreSQL + health checks.
- Local Supabase Auth development configuration with email confirmation required.
- CI proof that unverified email cannot obtain an authenticated session.
- Supabase JWT verification through asymmetric JWKS only (`ES256`, `RS256`, `EdDSA`).
- JWT validation for signature, project issuer, audience, expiration, and required subject.
- CI proof using a real confirmed local Supabase user token and the live local JWKS endpoint.
- Automated backend lint, formatting, unit, migration, Docker, and Auth smoke tests.

Not implemented yet:

- authenticated `GET /api/v1/me`
- first-login creation/linking of the internal DDD User
- account-status enforcement on authenticated requests
- DDD role/resource authorization dependencies
- production profile, matching, game, booking, registration, calendar, and Game Hub APIs

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

The repository CI additionally boots local Supabase Auth and verifies a real confirmed user JWT through `/.well-known/jwks.json`.

## Architecture rule

Authentication identifies the caller. Authorization remains DDD application policy enforced server-side. Never authorize a protected operation merely because the browser supplied a user ID, role, venue ID, game ID, or other ownership claim.
