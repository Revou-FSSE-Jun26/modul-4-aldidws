# AI Output Comparison Report — RevoTask

This document summarises measurable differences between initial AI-generated code and
the corrected versions after applying the engineering guidelines in `/guidelines/`.

Evidence is drawn from the AI Improvement Log in `specs/CHANGELOG.md`.

---

## Summary

| Fix | Guideline | Before | After | Impact |
|-----|-----------|--------|-------|--------|
| Card ordering column | `database.md` — Float for ordering | `Integer position`, O(n) reorders | `Float order`, midpoint insert | Drag-and-drop scales to any list length |
| Business logic in route | `backend.md` — Thin routes / Service layer | DB query + ownership check in route handler | Logic extracted to `service.py` | Service testable without HTTP context |
| Error response format | `backend.md` — Standard envelope | `{"error": "Card not found"}` (plain string) | `{"error": {"code": ..., "message": ...}}` | Frontend type-guard works across all endpoints |
| `waitForTimeout` in tests | `testing.md` — No hardcoded waits | `page.waitForTimeout(2000)` calls | Playwright auto-waiting assertions | Tests run faster and reliably without race conditions |
| Raw button vs BaseButton | `frontend.md` — Shared primitives | 7-line Tailwind class string duplicated | `<BaseButton variant="primary">` | Single source of truth for button styles |

---

## Fix 1 — Card Ordering: Integer → Float

**Guideline:** `database.md` §5 (Data Types) and §11 (Ordering and Reordering)

**Before:** The initial AI output generated `position: Mapped[int]` with an `Integer`
database column. Inserting a card between positions 1 and 2 required shifting every
card at or above position 2 — an O(n) database write on every drag-and-drop operation.

**After:** The corrected model uses `order: Mapped[float]` with `Float`. Placing a card
between `order=1.0` and `order=2.0` assigns `order=1.5` with no writes to other rows.
The schema validator was updated from `fields.Integer` to `fields.Float`, and a
`CheckConstraint` with `Index` was added.

**Measurable difference:** Reorder operations went from O(n) writes to O(1).

---

## Fix 2 — Business Logic in Route Handler → Service Layer

**Guideline:** `backend.md` §3 (Route Handler Standards) and §4 (Service Layer Standards)

**Before:** The initial AI output for `comments/routes.py` contained direct SQLAlchemy
queries, board-ownership checks, and `db.session.commit()` inside the route handler
function — 15 lines of mixed HTTP and business logic.

**After:** The route handler is 3 lines (validate → call service → return). All
ownership verification, card lookup, and database writes moved to `comments/service.py`.
The service function can be called in unit tests with no Flask context.

**Measurable difference:** Service test coverage became possible without a running
Flask test client.

---

## Fix 3 — Error Envelope Standardisation

**Guideline:** `backend.md` §8 (API Response Standards)

**Before:** Multiple routes returned `{"error": "some string"}` — a plain string value.
The frontend `isFlaskErrorEnvelope` type guard expected `error.code` and `error.message`
fields and silently failed to parse these responses.

**After:** All error paths route through the global `register_error_handlers` handlers
which always emit `{"error": {"code": "...", "message": "...", "details": ...}}`.
No route handler formats its own error responses.

**Measurable difference:** Zero inconsistent error shapes across the 8 Flask blueprints.

---

## Fix 4 — `waitForTimeout` Removal from Playwright Tests

**Guideline:** `testing.md` §15 (Flaky Test Management) and Playwright specification

**Before:** `kanban-journey.spec.ts` contained three `page.waitForTimeout()` calls
(2000 ms, 1000 ms, 500 ms) totalling 3.5 seconds of unconditional sleep per test run.
On a slow CI machine this was still insufficient, causing intermittent failures.

**After:** Every `waitForTimeout` was replaced with Playwright auto-waiting assertions
(`expect(locator).toBeVisible()`, `await locator.click()`). Playwright polls until the
condition is met or the default timeout expires.

**Measurable difference:** Test wall-clock time reduced by ~3.5 s per run; intermittent
timeout failures eliminated.

---

## Fix 5 — Raw `<button>` Replaced with `<BaseButton>`

**Guideline:** `frontend.md` §2.5 (Component Composition), §4.8 (Shared UI Components),
§5.7 (Shared Primitive Styling)

**Before:** `app/login/page.tsx` and `app/register/page.tsx` each contained a raw
`<button>` element with a 7-line Tailwind class string. The class strings diverged
slightly between pages (different hover colours, ring colours), creating visual
inconsistency that would require manual synchronisation on every design change.

**After:** Both pages use `<BaseButton type="submit" variant="primary">`. All variant
styles are defined once in `BaseButton.tsx`.

**Measurable difference:** Styling a button variant now requires one file edit instead of
N edits across N pages.

---

*Content was rephrased for compliance with licensing restrictions.*
*Source data drawn from `specs/CHANGELOG.md` — AI Improvement Log entries Fix 1–5.*
