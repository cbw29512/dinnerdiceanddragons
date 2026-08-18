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

## Fail-closed production configuration

`APP_ENV=production` is a trust boundary. FastAPI construction fails before serving requests when required production settings are unsafe or incomplete.

Production rejects:

- local/loopback PostgreSQL endpoints;
- the local `ddd:ddd` database credential pair;
- PostgreSQL URLs that do not use the `postgresql+psycopg` driver;
- missing/non-HTTPS/local Supabase URLs;
- blank JWT audience;
- missing Geocodio credential;
- empty, wildcard, HTTP, or loopback CORS origins.

Private-network database endpoints remain valid because a production database may legitimately live inside a private VPC/network.

## Required backend environment variables

Configure these as deployment service variables. Do not commit real values to GitHub.

```text
APP_ENV=production
LOG_LEVEL=INFO
APP_VERSION=<release version>
BUILD_SHA=<deployed source commit>
DATABASE_URL=<managed PostgreSQL SQLAlchemy URL>
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_JWT_AUDIENCE=authenticated
GEOCODIO_API_KEY=<server-side provider credential>
CORS_ALLOWED_ORIGINS=https://cbw29512.github.io
```

The bounded runtime settings have safe defaults but may be tuned only through reviewed deployment configuration:

```text
DB_CONNECT_TIMEOUT_SECONDS=5
DB_STATEMENT_TIMEOUT_MS=30000
DB_LOCK_TIMEOUT_MS=5000
DB_IDLE_TRANSACTION_TIMEOUT_MS=15000
DB_POOL_SIZE=5
DB_MAX_OVERFLOW=5
DB_POOL_TIMEOUT_SECONDS=5
DB_POOL_RECYCLE_SECONDS=300
OUTBOUND_HTTP_TIMEOUT_SECONDS=5
```

Do not use `*` for production CORS. Add an origin only when a real frontend is deployed at that exact HTTPS origin.

## Database URL and timeout policy

The application expects a SQLAlchemy/Psycopg URL, for example:

```text
postgresql+psycopg://<user>:<password>@<host>:5432/<database>
```

Use managed provider credentials. Never deploy the local `ddd:ddd` development credentials.

`DB_CONNECT_TIMEOUT_SECONDS` is applied at connection establishment. Statement, lock, and idle-in-transaction limits are applied with PostgreSQL transaction-local settings at the start of every application `Session` transaction.

This distinction matters for Supabase/Supavisor transaction mode on port `6543`: transaction pooling does not preserve session-level timeout settings between transactions. DDD therefore applies those three limits inside each transaction instead of relying on connection startup options. Transaction-mode endpoints still use `NullPool` and disable psycopg prepared statements. Direct/session-pooler endpoints use bounded SQLAlchemy pool size, overflow, wait timeout, recycle, and pre-ping settings.

The Docker/PostgreSQL CI contract opens the same application Session used in production and verifies PostgreSQL reports the configured transaction-local timeout values.

### Migration privilege boundary

The web image contains Alembic so a controlled release job can run migrations, but the long-running web process must not automatically migrate on startup. Production should use separate migration credentials with schema-change privileges when the selected host/database plan supports practical credential separation. The steady-state API credential should be reduced to only the DML privileges the application needs. This remains an operational deployment control until separate production roles are configured and verified.

## Outbound provider timeout policy

`OUTBOUND_HTTP_TIMEOUT_SECONDS` is the shared hard bound used for:

- Supabase JWKS retrieval;
- Geocodio public Venue geocoding;
- Geocodio postal-centroid lookup.

Provider-backed Geocodio calls do not automatically retry inside the adapter. A timeout/provider error is surfaced to the controlled API error path, and a deliberate retry remains subject to the application abuse/rate-limit policy. This avoids multiplying externally metered requests during provider incidents.

## Browser origin policy

`CORS_ALLOWED_ORIGINS` is a comma-separated list of exact HTTP(S) browser origins. Origins must not contain paths, queries, or fragments. Production additionally requires HTTPS and rejects loopback/local origins.

For the current GitHub Pages frontend, the origin is:

```text
https://cbw29512.github.io
```

The repository path `/dinnerdiceanddragons/` is not part of the browser origin.

## Container host contract

Any production container host must preserve the same contract:

1. Build from `backend/Dockerfile`.
2. Run the application as the image's fixed non-root identity (`10001:10001`), never as root.
3. Prefer a read-only root filesystem. Provide only a small bounded writable scratch mount such as `/tmp` when the host requires temporary space.
4. Drop Linux capabilities and enable `no-new-privileges` where the host exposes those controls.
5. Inject valid fail-closed production environment variables and a runtime `PORT` when required by the host.
6. Apply `alembic upgrade head` as a controlled pre-deploy/migration step, not from the long-running web process.
7. Start Uvicorn on `0.0.0.0:$PORT`.
8. Require `/api/v1/health` to return HTTP 200 before activation.
9. Reject activation when migration, configuration, CORS, auth, runtime-hardening, or health checks fail.

The repository deployment contract proves the API starts as UID/GID `10001`, with a read-only root filesystem, all Linux capabilities dropped, `no-new-privileges`, and only a bounded `/tmp` tmpfs. A production host that cannot express every Docker runtime flag must provide equivalent isolation controls and document the exception.

### Why this image remains single-stage

The production image installs only prebuilt, hash-verified Python wheels and does not install a compiler or build toolchain. A second Docker build stage would not currently remove meaningful build-only dependencies from the final filesystem. Revisit multi-stage packaging if a future dependency requires compilation or application assets are built inside the container.

## Verification after deployment

Verify the public API URL before activating a browser configuration change:

```text
GET /api/v1/health
GET /api/v1/version
```

Expected liveness JSON:

```json
{"status":"ok","service":"dinner-dice-and-dragons-api"}
```

`/api/v1/version` must contain only the service name, application version, build SHA, and environment. It must never expose database URLs, provider credentials, auth secrets, or internal runtime configuration.

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

A failed migration, unsafe production configuration, unhealthy container, invalid CORS configuration, failed auth verification, failed runtime-hardening verification, or failed browser smoke blocks activation. Roll back to the last known-good application/configuration pair rather than partially activating a new frontend/API origin.
