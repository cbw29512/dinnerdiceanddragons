# Netlify production setup

Dinner, Dice & Dragons is prepared for **GitHub → Netlify continuous deployment**.

## Netlify import

1. Add a new Netlify project from the existing GitHub repository `cbw29512/dinnerdiceanddragons`.
2. Use `main` as the production branch.
3. Keep the repository settings from `netlify.toml`; do not replace the build command or publish directory in the UI.
4. Add the server-only Netlify environment variable `DDD_API_ORIGIN=https://<your-fastapi-container-host>`.
5. Deploy only after the FastAPI origin returns HTTP 200 from `/api/v1/health`.

The Netlify build creates `dist/` and publishes only browser assets. Backend source, tests, GitHub workflows, Supabase project files, internal docs, and the prototype dashboard are intentionally excluded.

## API topology

The browser talks only to the Netlify origin at `/api/...`. `netlify/functions/api-proxy.mjs` forwards those calls to `DDD_API_ORIGIN`. The upstream FastAPI URL is therefore server-side configuration, not browser configuration.

The existing FastAPI service remains a Docker workload. Its secrets stay on the API/container host, including `DATABASE_URL`, `GEOCODIO_API_KEY`, and any deployment credentials. Do not put those values in browser JavaScript or `netlify.toml`.

## Auth configuration

After Netlify assigns the production URL, add that HTTPS origin and the `join.html` callback to the Supabase Auth site/redirect allow-list. Repeat for the final custom domain when one is attached.

Set the FastAPI `CORS_ALLOWED_ORIGINS` production value to the final Netlify/custom-domain HTTPS origin. The browser uses the Netlify same-origin proxy, but the API still validates production CORS configuration at startup.

## Production smoke test

Before creating real marketplace accounts, verify in order:

- `/`
- `/join.html`
- `/venues.html`
- `/api/v1/health`
- sign up and confirm one test account
- authenticated `/api/v1/me`
- Player demand save
- GM supply save
- Venue table-window save and verification
- Table Match → Event → seat request → approval → Game Hub

If `/api/v1/health` does not succeed through the Netlify URL, stop there and fix the upstream API configuration before testing accounts.
