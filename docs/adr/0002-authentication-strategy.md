# ADR-0002: In-memory JWT access tokens — MVP strategy

**Status:** Accepted  
**Date:** 2026-11-28  

## Context

The project required authenticated sessions for all protected resources. Options considered were server-managed sessions (cookies), JWT stored in `localStorage`, JWT stored in memory (React context), and JWT with a refresh-token rotation flow.

## Decision

Use short-lived JWT access tokens stored in React context (in-memory only). The token is never written to `localStorage` or `sessionStorage`. No refresh token endpoint is exposed in the initial release. As a consequence, a full page reload clears the session and requires the user to log in again. This is an accepted MVP trade-off.

## Alternatives Considered

- **`localStorage` JWT** — simple persistence across reloads, but exposes the token to any XSS on the page. Rejected on security grounds.
- **Server-managed sessions with cookies** — secure with `HttpOnly`/`Secure`/`SameSite` cookies, but requires CSRF mitigation for every state-changing request. Deferred for a later phase.
- **JWT with refresh token rotation** — a `refresh_tokens` database table and model already exist in the codebase but the endpoint is not exposed. Full implementation is tracked under requirements R9.4–R9.5 and deferred to a future phase.

## Consequences

- Simpler implementation with no CSRF handling required for the MVP.
- No persistent login across page reloads; users are logged out on refresh.
- The `refresh_tokens` table is present but dormant — it can be activated in a future phase without a schema migration.
- R9.4 (refresh token endpoint) and R9.5 (persistent session) remain open tasks.
