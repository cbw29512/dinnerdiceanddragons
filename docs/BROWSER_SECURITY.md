# Browser Security Architecture

## Scope

This document describes the authenticated browser boundary for Dinner, Dice & Dragons and the residual risks that remain before the enterprise production gate can close.

## Current pilot topology

- Public web origin: GitHub Pages (`https://cbw29512.github.io/dinnerdiceanddragons/`).
- Browser API target: the Vercel-hosted FastAPI service configured in `production-config.js`.
- Identity provider and token issuer: Supabase Auth.
- Durable application identity, authorization, and role decisions: FastAPI + PostgreSQL.

`production-config.js` is public configuration only. It may contain public origins and the Supabase publishable key. Provider secrets, service-role keys, database credentials, signing material, and admin credentials must never be added to it.

## Session storage policy

The current static-host architecture still requires the browser to hold a Supabase refresh token. New sessions are stored only in `sessionStorage`, not persistent `localStorage`.

At startup, `production-session-store.js` performs a one-time migration of the legacy `ddd-production-auth-session` value from `localStorage` into `sessionStorage`, then deletes the legacy copy. Sign-out clears both locations.

### What this improves

- Closing the tab removes the stored session in normal browser behavior.
- Refresh tokens are no longer intentionally persisted across browser restarts.
- Old persistent DDD session copies are actively removed.
- Separate tabs no longer automatically share the DDD refresh token through localStorage.

### What this does not solve

`sessionStorage` is still JavaScript-readable. A successful XSS in the same tab could read an active refresh token. This is a risk reduction, not the final enterprise session design.

The target enterprise architecture is a dedicated canonical web origin with a same-site backend/BFF session where refresh/session credentials can be held in `HttpOnly`, `Secure`, appropriately `SameSite` cookies and are not readable by application JavaScript. That migration also needs CSRF protections appropriate to the chosen cookie/session design.

## Production browser configuration

`production-auth.js` must fail closed when `window.DDDProductionConfig` is missing or malformed. Production API and Supabase origins must use HTTPS. The browser API client is configured from `production-config.js`; production host changes must not be hidden inside authentication code.

## Interim Content Security Policy

Authenticated pages use a meta-delivered CSP while they remain on GitHub Pages. The current policy restricts scripts to same-origin files, limits outbound connections to explicitly required services, blocks objects and frames, restricts forms/base URLs to self, and upgrades insecure requests.

This is only an interim control. A meta CSP cannot provide every response-header security control. In particular, the final production host must enforce response headers for at least:

- `Content-Security-Policy` including an appropriate `frame-ancestors` directive;
- `Strict-Transport-Security`;
- `X-Content-Type-Options: nosniff`;
- `Referrer-Policy`;
- `Permissions-Policy`;
- a consistent framing policy.

GitHub Pages is therefore not the final enterprise authenticated application host.

## DOM/XSS rules

Production-reachable code must treat API data, messages, profile names, Venue names, query/hash values, provider errors, and stored values as untrusted.

Required rules:

1. Prefer `textContent`, DOM node construction, and fixed attribute values.
2. Do not interpolate untrusted values into `innerHTML` or `insertAdjacentHTML`.
3. Do not accept `javascript:` or arbitrary redirect URLs from user/API input.
4. Clear auth callback tokens from the visible URL before storing or rendering application state.
5. Do not log access tokens, refresh tokens, authorization headers, private messages, or exact private location data.
6. Keep stored-XSS browser regressions for live message and profile-like content.

Static template-only `innerHTML` uses must still be reviewed and should be replaced where practical to reduce the number of dangerous sinks in production code.

## Release verification

Browser-security changes must keep the existing frontend quality gate green, including JavaScript/static checks, Playwright keyboard/WCAG/reflow/runtime tests, stored-XSS regression coverage, and Lighthouse. Auth changes must also preserve the Supabase Auth smoke and backend authorization contracts.

## Remaining enterprise blockers

This document does not close Issue #44 by itself. Remaining work includes the full DOM sink audit, response-header-capable canonical host, final HttpOnly session architecture, security-header verification, malicious-input browser coverage across additional production surfaces, and removal/isolation of obsolete pilot paths.
