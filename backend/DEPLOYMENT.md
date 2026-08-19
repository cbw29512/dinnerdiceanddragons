# Production API Deployment

## Production topology

Dinner, Dice & Dragons uses a split deployment with a single public web origin:

- **Frontend:** Netlify, continuously deployed from GitHub `main`.
- **Browser API path:** same-origin `/api/...` on Netlify.
- **API bridge:** `netlify/functions/api-proxy.mjs`, configured with server-only `DDD_API_ORIGIN`.
- **API runtime:** Dockerized FastAPI application under `/backend` on a container host.
- **Database/Auth:** managed PostgreSQL + Supabase Auth.

The browser must not contain a container-host API origin. Netlify forwards authenticated API calls server-to-server, which keeps deployment routing out of browser configuration and removes the frontend's direct CORS dependency on the API host.

`backend/railway.toml` remains a ready container-host configuration. Another compatible container host is acceptable if it preserves the runtime contract below.

## Fail-closed production configuration

`APP_ENV=production` is a trust boundary. FastAPI construction fails before serving requests when required production settings are unsafe or incomplete.

Production rejects local/loopback PostgreSQL, local development credentials, non-psycopg PostgreSQL URLs, missing/non-HTTPS Supabase URLs, blank JWT audience, missing Geocodio credentials, and empty/wildcard/HTTP/loopback CORS origins.

## Required backend environment variables

Configure these only on the API/container host:

```text
APP_ENV=production
LOG_LEVEL=INFO
APP_VERSION=<release version>
BUILD_SHA=<deployed source commit>
DATABASE_URL=<managed PostgreSQL SQLAlchemy URL>
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_JWT_AUDIENCE=authenticated
GEOCODIO_API_KEY=<server-side provider credential>
CORS_ALLOWED_ORIGINS=https://<production-netlify-or-custom-domain>
```

The bounded database and outbound HTTP settings in `.env.example` have safe defaults and may be tuned only through reviewed deployment configuration.

Do not use `*` for production CORS. Even though browsers call the same-origin Netlify proxy, the API's production configuration intentionally requires an explicit trusted HTTPS origin.

## Netlify boundary

Netlify receives only one server-side API routing variable:

```text
DDD_API_ORIGIN=https://<fastapi-container-host>
```

Do not copy `DATABASE_URL`, `GEOCODIO_API_KEY`, database credentials, Supabase service-role keys, or other backend secrets into the frontend or repository. The Supabase publishable browser key remains public by design; privileged keys do not.

The Netlify build produces `dist/` from reviewed public assets and excludes backend source, tests, internal docs, GitHub workflows, Supabase project files, Apps Script, and the prototype dashboard.

## Database and migration contract

The application expects a SQLAlchemy/Psycopg URL such as:

```text
postgresql+psycopg://<user>:<password>@<host>:5432/<database>
```

Use managed provider credentials. The long-running API process must not migrate automatically on startup. Apply `alembic upgrade head` as a controlled pre-deploy step. When practical, use separate migration credentials with schema-change privilege and a reduced-privilege steady-state API role.

Supabase/Supavisor transaction-mode endpoints on port `6543` use `NullPool`; the application applies statement, lock, and idle-in-transaction limits within each transaction. Direct/session-pooler endpoints use bounded SQLAlchemy pooling.

## Container host contract

Any production container host must:

1. Build from `backend/Dockerfile`.
2. Run as the fixed non-root identity `10001:10001`.
3. Prefer a read-only root filesystem and bounded writable scratch space only where required.
4. Drop Linux capabilities and enable `no-new-privileges` where the host exposes those controls.
5. Inject valid production variables and the host-provided `PORT`.
6. Run `alembic upgrade head` as a controlled migration step.
7. Start Uvicorn on `0.0.0.0:$PORT`.
8. Require `/api/v1/health` to return HTTP 200 before activation.
9. Reject activation when migration, configuration, auth, runtime-hardening, or health checks fail.

The GitHub Production Deployment Contract continuously proves the image accepts an injected port, starts as UID/GID `10001`, runs with a read-only root filesystem, drops all Linux capabilities, enables `no-new-privileges`, and becomes healthy.

## Release verification

Verify the API origin directly first:

```text
GET /api/v1/health
GET /api/v1/version
```

Then configure `DDD_API_ORIGIN` in Netlify and verify through the public Netlify origin:

```text
GET /api/v1/health
```

After the public proxy health check succeeds:

1. Add the Netlify production URL and final custom domain, when applicable, to the Supabase Auth site/redirect allow-list.
2. Verify sign-up/email-confirmation returns to `/join.html` on the same public origin.
3. Verify a real Supabase JWT with authenticated `/api/v1/me`.
4. Run the controlled Player + GM + Venue Table Match acceptance test through Event formation, seat request/approval, Venue approval, and Game Hub.

A failed migration, unsafe configuration, unhealthy API, broken proxy, invalid auth callback, or failed browser smoke blocks activation. Roll back to the last known-good deployment/configuration pair rather than partially activating the release.
