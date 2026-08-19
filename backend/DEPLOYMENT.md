# Reference FastAPI Runtime

## Production topology

Dinner, Dice & Dragons now uses Netlify as the application runtime:

- **Frontend:** Netlify, continuously deployed from GitHub `main`.
- **Application API:** native Netlify Function at same-origin `/api/...`.
- **Database/Auth:** managed PostgreSQL + Supabase Auth.
- **Production URL:** `https://dinnerdiceanddragons.netlify.app`.

The Dockerized FastAPI application under `/backend` is retained as a **reference implementation, Alembic migration source, and regression-test oracle**. It is not part of the production request path and does not require a separate Railway/container deployment.

## Why the backend remains in the repository

The Python implementation still provides high-value executable contracts for:

- schema and Alembic migration history
- deterministic Table Match behavior
- authorization and identity-linking invariants
- Event, registration, Venue booking, and GameTable lifecycle tests
- PostgreSQL integration and RLS contract tests
- compatibility checks while native Netlify behavior reaches full parity

Do not deploy this directory merely because it contains `Dockerfile` or `railway.toml`. Those files are retained for reproducibility and fallback testing, not as the current production architecture.

## Production server configuration

The production Netlify Function uses a server-only Supabase key configured in the Netlify environment:

```text
SUPABASE_SECRET_KEY=sb_secret_...
```

Never commit or expose that value in browser JavaScript, source control, screenshots, logs, or chat. The function validates user bearer tokens through Supabase Auth before using privileged database access for application operations.

The Supabase project URL and publishable key are public values. They may be set explicitly as `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`, although the production function pins the current Dinner Dice & Dragons public project configuration as a safe default.

## Database and migration contract

Production PostgreSQL schema remains managed through Alembic migration files in `backend/alembic/versions/`.

Before a migration is promoted:

1. validate it in PostgreSQL CI
2. apply it deliberately to the production Supabase database
3. verify the resulting Alembic revision
4. run Supabase security advisors
5. deploy native application code only after schema compatibility is proven

As of the Netlify full-stack migration, production is expected at:

```text
0022_signal_availability
```

The web/API runtime must never attempt opportunistic schema changes during an end-user request.

## Reference container contract

The reference Docker image remains hardened so it can be used for local parity checks or an emergency fallback if explicitly chosen later:

1. build from `backend/Dockerfile`
2. run as UID/GID `10001:10001`
3. prefer a read-only root filesystem
4. drop Linux capabilities and use `no-new-privileges`
5. accept an injected `PORT`
6. expose `/api/v1/health`

This is no longer a Netlify deployment prerequisite.

## Production release verification

The current release gate is entirely through Netlify:

1. `GET https://dinnerdiceanddragons.netlify.app/api/v1/health`
2. Supabase Auth signup and email confirmation to `/join.html`
3. authenticated `/api/v1/me`
4. Player onboarding and demand
5. GM onboarding and supply
6. verified Venue table window
7. three-way hard fit and BOOM GameTable
8. Event formation
9. Player seat request and GM decision
10. Venue booking decision when required
11. confirmed Game Hub and role-scoped messaging

A failed native Function deploy, schema mismatch, invalid server secret, broken auth callback, or failed production smoke test blocks activation.
