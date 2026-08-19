# Netlify production setup

Dinner, Dice & Dragons uses **GitHub → Netlify continuous deployment** for the entire production application stack.

Production URL: `https://dinnerdiceanddragons.netlify.app`

## Runtime topology

- Browser UI: Netlify static deployment from `dist/`
- Application API: native Netlify Function at `/api/*`
- Relational data: Netlify Database (managed PostgreSQL)
- Authentication: Netlify Identity
- Source of truth: GitHub `main`

There is no external application host or production database/auth provider in the request path. The original FastAPI/Alembic implementation remains in `/backend` as a reference implementation and regression oracle while the native Netlify runtime preserves the same product contracts.

## Netlify Database

The production schema is version controlled at:

`netlify/database/migrations/0001_initial_schema.sql`

Netlify automatically provisions the managed PostgreSQL database when the project containing `@netlify/database` is deployed and automatically applies version-controlled migrations. Deploy previews receive isolated database branches, so preview testing cannot mutate the production database.

No hand-written database URL or database password belongs in the repository or browser configuration.

The `/api/v1/health` endpoint executes a real database query. A production or deploy-preview environment is healthy only when it returns HTTP 200 with:

```json
{
  "status": "ok",
  "runtime": "netlify-functions",
  "database": "netlify-database",
  "identity": "netlify-identity",
  "version": "v1"
}
```

## Netlify Identity

Enable Identity in the Netlify project before acceptance testing:

1. Open **Project configuration → Identity**.
2. Select **Enable Identity**.
3. Set registration to **Open** for the controlled public beta.
4. Keep email confirmation required; do not enable autoconfirm for production.

The browser sends email/password requests only to same-origin `/api/v1/auth/*` endpoints. Netlify Identity establishes secure `nf_jwt` and `nf_refresh` cookies. Protected API handlers verify the current user server-side with `@netlify/identity`.

Player, GM, and Venue Manager are DDD application roles stored in PostgreSQL. Privileged `admin` and `moderator` roles may additionally be assigned in Netlify Identity and are synchronized into the DDD role table when that user authenticates.

## Deploy behavior

Netlify reads `netlify.toml` from the repository. Do not override the repository build command, publish directory, or Functions directory in the UI.

- Build command: `npm run build:netlify`
- Publish directory: `dist`
- Functions directory: `netlify/functions`
- Production branch: `main`

The build publishes browser assets only. Backend reference source, tests, workflows, internal docs, and prototypes are excluded from `dist/`. Netlify Functions are bundled separately and Netlify Database migrations run as part of the deployment lifecycle.

## Production smoke test

Before opening the marketplace broadly, verify in order:

1. `/`
2. `/join.html`
3. `/venues.html`
4. `/api/v1/health` returns HTTP 200 and reports `netlify-database` + `netlify-identity`
5. create a test account
6. confirm the Identity email
7. sign in and verify authenticated `/api/v1/me`
8. Player onboarding → demand → matching
9. GM onboarding → supply → matching
10. Venue onboarding → admin verification → weekly table window
11. three-way hard fit → BOOM persistent GameTable
12. GM forms Event
13. Player requests seat
14. GM confirms Player
15. Venue approves booking when approval is required
16. Game Hub and role-scoped messages
17. sign out and verify protected endpoints close again

If `/api/v1/health` fails, stop there and fix the Netlify Functions/Database deployment before testing accounts.

## Reference backend

`/backend` and its Alembic history remain in the repository for regression comparison and schema provenance. They are **not** deployed as the production web/API runtime.
