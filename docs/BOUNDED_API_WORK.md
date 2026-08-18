# Bounded API Work Policy

## Objective

Ensure one authenticated request cannot cause unbounded response, database-loading, or synchronous Table Match computation work.

This policy complements the 64 KiB mutation-body guard and distributed mutation rate limits already on `main`. Frequency limits and work-per-request limits are separate controls; both are required.

## User-facing list bounds

The following owner/participant reads are hard-capped in the SQL query rather than slicing Python results after loading:

- Player demand history: 100 most recent rows.
- GM supply history: 100 most recent rows.
- Venue table windows: 100 rows, with active windows ordered first.
- Table Match opportunity list: 100 earliest proposed opportunities for the authenticated caller.

These are launch bounds, not pagination contracts. If product UX requires history beyond these windows, add cursor pagination before increasing or removing the caps.

## Table Match candidate loading

The production matcher must never silently truncate its input universe because truncation could create a plausible-looking but incorrect match result.

Each candidate class therefore uses a `cap + 1` query:

- GM candidate rows: maximum 500.
- Venue candidate rows: maximum 500.
- Player candidate rows: maximum 500.

If the extra row exists, matching fails explicitly with `TableMatchCapacityError` instead of computing against a partial snapshot.

Candidate loading is split into separate GM, Venue, and Player modules so each query and mapping path remains reviewable and below the project's module-size limit.

## Synchronous computation budget

Before the nested matcher loops begin, the engine calculates the deterministic upper-bound proxy:

`GM candidates * Venue candidates * (Player candidates + 1)`

The launch ceiling is 250,000 work units. A larger snapshot is rejected before distance/availability/player-fit computation begins.

The admin matching endpoint translates capacity overflow to HTTP 503 with `Retry-After: 300`. This is intentionally different from horizon validation: a request outside the 90-day horizon is invalid input (422), while a candidate population above synchronous capacity is a service-capacity condition.

## Scaling rule

Do not raise these limits merely because the product grows. First profile the matcher under representative production data. When the synchronous ceiling becomes a normal operating constraint, partition candidate retrieval by system/geography/time or move matching to a bounded job/queue architecture, then update the limits with load-test evidence.

## Validation

CI must prove:

- list-query SQL includes the configured limits;
- candidate `cap + 1` overflow raises rather than truncates;
- small snapshots remain valid;
- snapshots above the computation budget fail before matching work;
- existing Table Match engine and PostgreSQL contracts remain green.
