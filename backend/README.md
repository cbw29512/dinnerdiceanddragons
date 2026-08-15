# Dinner, Dice & Dragons — Production API

This directory is the production FastAPI backend. It is intentionally separate from the GitHub Pages validation site while production identity, persistence, authorization, and workflows are built and proven.

## Current scope

Implemented:

- FastAPI application factory and versioned `/api/v1` route namespace.
- Dependency-free `GET /api/v1/health` liveness endpoint.
- Authenticated `GET /api/v1/me` endpoint with a safe response model.
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
- Safe first-login mapping from verified Supabase `sub` to one durable internal DDD User.
- Idempotent repeat login, verified-email synchronization, and refusal of ambiguous email/provider collisions.
- Centralized current-user and active-account policy dependencies.
- Verified pending accounts safely activate; restricted, suspended, and banned accounts remain visible through `/me` but cannot enter protected participation/mutation flows.
- CI guard requiring every future `/api/v1` POST/PUT/PATCH/DELETE route to depend on the active authenticated DDD account policy.
- CI proof using a real confirmed local Supabase token, live JWKS, Uvicorn/FastAPI HTTP, Alembic migrations, and real PostgreSQL persistence.
- Automated backend lint, formatting, unit, migration, Docker, Auth, browser, and Lighthouse tests.

Not implemented yet:

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

The repository CI additionally boots local Supabase Auth, obtains a real confirmed user JWT, verifies it through `/.well-known/jwks.json`, calls the real `/api/v1/me` endpoint over HTTP, and proves exactly one durable DDD user is persisted in PostgreSQL for that provider subject.

## Architecture rule

Authentication identifies the caller. Authorization remains DDD application policy enforced server-side. Never authorize a protected operation merely because the browser supplied a user ID, role, venue ID, game ID, or other ownership claim.
