# Netlify production setup

Dinner, Dice & Dragons uses **GitHub → Netlify continuous deployment** for the public site and the production application API.

Production URL: `https://dinnerdiceanddragons.netlify.app`

## Runtime topology

- Browser UI: Netlify static deployment from `dist/`
- Application API: native Netlify Function at `/api/*`
- Managed database and authentication: Supabase
- Source of truth: GitHub `main`

There is no external FastAPI/container host in the production request path. The original FastAPI implementation remains in `/backend` as the reference implementation, migration source, and regression-test oracle while the native Netlify runtime proves parity.

## Required Netlify environment

Configure this value in Netlify project environment variables. Never put it in browser JavaScript, GitHub source, screenshots, or chat messages.

- `SUPABASE_SECRET_KEY` — a current Supabase server-side `sb_secret_...` key for the Dinner Dice & Dragons project

The native function already pins the public Supabase project URL and publishable key used by the browser. They may optionally be supplied explicitly as `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`.

The secret key is used only inside the Netlify server runtime. User bearer tokens are independently validated with Supabase Auth before any application operation is authorized.

## Auth configuration

Supabase Auth must allow the production site and callback:

- Site URL: `https://dinnerdiceanddragons.netlify.app`
- Redirect URL: `https://dinnerdiceanddragons.netlify.app/join.html`

Repeat the allow-list entries for the final custom domain after it is attached.

## Deploy behavior

Netlify reads `netlify.toml` from the repository. Do not override the repository build command, publish directory, or Functions directory in the UI.

- Build command: `npm run build:netlify`
- Publish directory: `dist`
- Functions directory: `netlify/functions`
- Production branch: `main`

The build publishes browser assets only. Backend source, tests, workflows, Supabase project files, internal docs, and prototypes are excluded from `dist/`. Netlify Functions are bundled separately by Netlify.

## Production smoke test

Before opening the marketplace broadly, verify in order:

1. `/`
2. `/join.html`
3. `/venues.html`
4. `/api/v1/health`
5. sign up and confirm a test account
6. authenticated `/api/v1/me`
7. Player onboarding → demand → matching
8. GM onboarding → supply → matching
9. verified Venue → weekly table window
10. three-way hard fit → BOOM persistent GameTable
11. GM forms Event
12. Player requests seat
13. GM confirms Player
14. Venue approves booking when approval is required
15. Game Hub and role-scoped messages

If `/api/v1/health` fails, stop there and fix the Netlify Functions deployment before testing accounts.
