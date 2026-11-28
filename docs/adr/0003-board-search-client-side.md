# ADR-0003: Card search via backend filter endpoint (D13)

**Status:** Accepted  
**Date:** 2026-11-28  

## Context

The initial design proposed browser-only text filtering of cards already loaded into the client. As boards grow, filtering a full in-memory card set on every keystroke would degrade performance and would not scale to paginated card lists.

## Decision

Search runs via the `GET /api/v1/cards?search=` backend endpoint. The frontend passes a debounced query string to the API, which performs a case-insensitive `ILIKE` match against card `title` and `description` on the server. This aligns with design decision D13.

## Alternatives Considered

- **Pure client-side filter** — fast for small boards with all cards already loaded. Acceptable for the current scale but degrades as card count grows and breaks once server-side pagination is introduced. Rejected as a long-term approach.
- **Full-text search index (PostgreSQL `tsvector`)** — provides ranking and language-aware stemming. Considered premature for the current data volumes; can be introduced later as an index-only change without altering the API contract.

## Consequences

- The backend handles filtering; the frontend state reflects the server result directly.
- URL filter parameters are serialized via `filterParams.ts`, making filter state shareable via URL.
- Adding new filterable fields requires only a backend schema change, not a frontend architecture change.
- Each keystroke (after debounce) triggers a network request; debounce delay is the primary UX lever for controlling request frequency.
