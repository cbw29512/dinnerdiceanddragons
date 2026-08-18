# Production API Deployment

## Current active pilot topology

Dinner, Dice & Dragons currently uses:

- **Public frontend:** GitHub Pages.
- **Browser API target:** Vercel, configured only through root `production-config.js`.
- **API runtime:** Dockerized FastAPI application under `/backend`.
- **Database/Auth:** managed PostgreSQL + Supabase Auth.

The browser client must not contain a second hidden API origin. `production-config.js` is the reviewed source of truth for the active public browser API and Supabase origins. It contains public configuration only and must never contain database credentials, service-role keys, provider secrets, or admin credentials.

The repository also retains `backend/railway.toml` as a supported container-host configuration. Railway is an alternative/future dedicated API host, not the active browser API target unless `production-config.js`, CORS, deployment documentation, and smoke tests are changed together in one reviewed release.

## Enterprise hosting direction

GitHub Pages and free preview/deployment quotas are suitable for pilot validation but are not the final enterprise authenticated hosting architecture. The enterprise target is a canonical production web origin that can enforce response security headers and support a same-site session/BFF design where practical. See `docs/BROWSER_SECURITY.md`.

## Required backend environment variables

Configure these as deployment service variables. Do not commit real values to GitHub.

```text
APP_ENV=production
LOG_LEVEL=INFO
DATABASE_URL=<managed PostgreSQL SQLAlchemy URL>
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_JWT_AUDIENCE=authenticated
CORS_ALLOWED_ORIGINS=https://cbw29512.github.io
```

Do not use `*` for production CORS. Add an origin only when a real frontend is deployed at that exact HTTP(S) origin.

## Database URL

The application expects a SQLAlchemy/Psycopg URL, for example:

```text
postgresql+psycopg://<user>:<password>@<host>:5432/<database>
```

Use managed provider credentials. Never deploy the local `ddd:ddd` development credentials.

## Browser origin policy

`CORS_ALLOWED_ORIGINS` is a comma-separated list of exact HTTP(S) browser origins. Origins must not contain paths, queries, or fragments.

For the current GitHub Pages frontend, the origin is:

```text
https://cbw29512.github.io
```

The repository path `/dinnerdiceanddragons/` is not part of the browser origin.

## Container host contract

Any production container host must preserve the same contract:

1. Build from `backend/Dockerfile`.
2. Inject production environment variables and a runtime `PORT` when required by the host.
3. Apply `alembic upgrade head` as a controlled pre-deploy/migration step.
4. Start Uvicorn on `0.0.0.0:$PORT`.
5. Require `/api/v1/health` to return HTTP 200 before activation.
6. Reject activation when migration, configuration, CORS, auth, or health checks fail.

`backend/railway.toml` implements this shape for Railway. The Vercel project must provide the equivalent application and migration contract through its configured backend project settings.

## Verification after deployment

Verify the public API URL before activating a browser configuration change:

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

Finally verify the configured browser origin succeeds on authenticated CORS preflight/request and that the production Game Hub can load a role-safe authenticated Event.

## Browser configuration release rule

Changing the production API or Supabase origin requires one reviewed change that updates and validates all of the following together:

- `production-config.js`;
- backend `CORS_ALLOWED_ORIGINS`;
- Supabase redirect/site URL allowlist as applicable;
- deployment/runbook documentation;
- production API health/auth checks;
- browser authentication and live Game Hub smoke tests.

Do not maintain undocumented competing production origins.

## Deployment quota and provider failures

A provider quota failure is an operational deployment failure even when code CI is green. Do not repeatedly retry deployments solely to clear a free-tier quota. Record the incident, preserve the last known-good release, and resume deployment when the provider quota/window permits or move to the approved production plan/host.

## Rollback rule

A failed migration, unhealthy container, invalid CORS configuration, failed auth verification, or failed browser smoke blocks activation. Roll back to the last known-good application/configuration pair rather than partially activating a new frontend/API origin.
