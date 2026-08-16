# Production API Deployment

## Target shape

The production API is a Dockerized FastAPI service backed by managed PostgreSQL and Supabase Auth.

For the current pilot deployment, Railway is the prepared container host. Supabase remains the PostgreSQL/Auth provider. GitHub Pages remains the public validation frontend until authenticated browser wiring is activated.

## Railway service setup

Create one Railway service from the `cbw29512/dinnerdiceanddragons` GitHub repository.

Set these service source values in Railway:

- **Root Directory:** `/backend`
- **Config File:** `/backend/railway.toml`
- **Public networking:** enabled after the first healthy deployment

With `/backend` as the service root, Railway detects `backend/Dockerfile` as the service Dockerfile. `railway.toml` runs `alembic upgrade head` before deployment activation and uses `/api/v1/health` as the deployment health check.

## Required environment variables

Configure these as Railway service variables. Do not commit real values to GitHub.

```text
APP_ENV=production
LOG_LEVEL=INFO
DATABASE_URL=<managed PostgreSQL SQLAlchemy URL>
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_JWT_AUDIENCE=authenticated
CORS_ALLOWED_ORIGINS=https://cbw29512.github.io
```

Do **not** set `PORT` in Railway unless there is a specific reason to override its provided port. The container listens on Railway's injected `PORT` and falls back to `8000` for local Docker use.

## Database URL

The application expects a SQLAlchemy/Psycopg URL, for example:

```text
postgresql+psycopg://<user>:<password>@<host>:5432/<database>
```

Use the managed provider's connection details. Do not copy local `ddd:ddd` credentials into a deployed environment.

## Browser origin policy

`CORS_ALLOWED_ORIGINS` is a comma-separated list of exact HTTP(S) browser origins. Origins must not contain paths, queries, or fragments.

For the current GitHub Pages site, the origin is:

```text
https://cbw29512.github.io
```

The repository path `/dinnerdiceanddragons/` is **not** part of the browser origin and must not be included in the CORS value.

Add other origins only when there is a real frontend deployed at that origin. Do not use `*` for the production API.

## Deployment sequence

1. Railway builds the production Docker image.
2. Railway injects runtime variables, including `PORT`.
3. The pre-deploy command runs `alembic upgrade head` against `DATABASE_URL`.
4. The container starts Uvicorn on `0.0.0.0:$PORT`.
5. Railway polls `/api/v1/health`.
6. The deployment becomes active only after the health endpoint returns HTTP 200.

## Verification after deployment

Verify the public API URL before wiring the browser client:

```text
GET /api/v1/health
```

Expected JSON:

```json
{"status":"ok","service":"dinner-dice-and-dragons-api"}
```

Then verify a real confirmed Supabase JWT against:

```text
GET /api/v1/me
```

Do not activate production onboarding forms until both checks pass and the configured GitHub Pages origin succeeds on an authenticated CORS preflight/request.

## Rollback rule

A failed migration, unhealthy container, invalid CORS configuration, or failed auth verification blocks frontend activation. Keep the existing GitHub Pages pilot flow available until the production API/Auth path has passed end-to-end browser verification.
