# Dinner, Dice & Dragons — Local Supabase Auth

This project uses Supabase Auth as the initial production authentication provider while FastAPI remains the Dinner, Dice & Dragons API/policy layer.

The committed `supabase/config.toml` configures a **local development Auth environment only**. It does not create or connect a hosted Supabase production project.

## Pinned CLI

Development/CI commands pin Supabase CLI `2.110.0` so local stack behavior does not silently drift.

The CLI runs through `npx` and requires a Docker-compatible container runtime.

## Start local Auth

From the repository root:

```bash
npx --yes supabase@2.110.0 start \
  -x realtime,storage-api,imgproxy,postgrest,postgres-meta,studio,edge-runtime,logflare,vector,supavisor
```

This keeps the services needed for authentication testing while excluding unrelated local products.

Inspect the local endpoints/keys:

```bash
npx --yes supabase@2.110.0 status
```

The standard local API gateway is configured on `http://127.0.0.1:54321` and local email inspection is configured on port `54324`.

## Email confirmation policy

Local Auth configuration intentionally sets:

```toml
[auth]
enable_signup = true
enable_anonymous_sign_ins = false

[auth.email]
enable_signup = true
enable_confirmations = true
```

This means local Auth is configured to require email confirmation rather than auto-confirming signups. The next production checklist checkpoint separately proves the end-to-end participation behavior before it is considered complete.

## Stop and reset local Auth

To stop while preserving local Supabase data:

```bash
npx --yes supabase@2.110.0 stop
```

To remove the local Supabase data volumes as well:

```bash
npx --yes supabase@2.110.0 stop --no-backup
```

## Security rules

- Never expose the local Supabase stack directly to the public internet.
- Do not commit hosted project credentials or service-role secrets.
- Keep real secrets in environment variables / ignored `.env` files.
- A Supabase Auth user is mapped to a stable internal DDD `User.id`; provider IDs are not the durable application identity.
- Supabase authentication does not replace FastAPI authorization.
