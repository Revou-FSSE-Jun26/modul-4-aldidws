# Frontend Audit Report — RevoTask Next.js

> Scope: audit the RevoTask Next.js frontend at `c:\Users\aldid\modulAIdevelopment\frontend`
> against the agreed checklist, apply concrete fixes for genuine gaps only, then verify
> with lint + build + grep.
> Iteration: FIRST (no prior review JSON existed; implemented the audit plan).
> Date: (run date)

## Summary

16 checklist items audited. **2 genuine gaps found and fixed** (BaseButton `destructive`
variant; `toast.showLoading`). The remaining 14 items were already compliant and were left
untouched to preserve existing working behavior. No new npm packages were added. No business
logic was changed.

Final tally: 16 audited → 2 fixed, 14 compliant.

## Checklist table

| # | Item | File:Line | Status | Fix Applied |
|---|------|-----------|--------|-------------|
| 1a | `/register`: controlled inputs + validation + `BaseButton` + `POST /api/auth/register` + toast/error + redirect `/login` | `app/register/page.tsx` (`post("/api/auth/register", …)`; `showSuccess`; `router.push("/login")`) | ✅ Compliant | None |
| 1b | `/login`: submits via `useAuth().login()` (POST `/api/auth/login`), stores JWT in AuthContext, `BaseButton`, redirect `/` | `app/login/page.tsx` (`useAuth().login`; `router.push("/")`; `BaseButton`) | ✅ Compliant | None |
| 1c | `/` Dashboard is a **Server Component** (no `"use client"`), fetches `GET /api/boards` via `get()`, displays boards | `app/page.tsx` (no `"use client"`; `dynamic="force-dynamic"`; `cookies()`; `get<Board[]>("/api/boards", {token})`) | ✅ Compliant | None |
| 1d | `/boards/[id]` is a **Server Component**, renders columns + cards Kanban | `app/boards/[id]/page.tsx` (no `"use client"`; `get<BoardDetail>("/api/boards/${id}", {token})`; column/card render) | ✅ Compliant | None |
| 1e | `CardDetailModal` is Client Component; `<BaseModal>` wraps `<CommentList>`; comment form POSTs `/api/cards/<id>/comments` | `components/board/CardDetailModal.tsx` (`"use client"`; `<BaseModal …>` at 356; `<CommentList …>` at 397; `</BaseModal>` at 408; `post("/api/cards/${cardId}/comments", …)` at 75) | ✅ Compliant | None |
| 1f | `/my-tasks`: `MyTasksList` (Client) fetches `GET /api/cards?assignee=me`, groups by board name | `components/board/MyTasksList.tsx` (`"use client"` 1; `fetch(\`${API_BASE}/api/cards?assignee=me\`, …)` at 47; `groupByBoard`) | ✅ Compliant | None — `?assignee=me` already present |
| 1g | `/profile`: Client Component; controlled inputs pre-filled from AuthContext; `BaseButton`; `PATCH /api/users/me` | `app/profile/page.tsx` (`"use client"` 1; `useAuth()`; seed `currentUser`; `BaseButton`; `fetch(\`${API_BASE}/api/users/me\`, {method:"PATCH", …})`) | ✅ Compliant | None |
| 2a | `BaseButton` supports `primary`, `secondary`, **and `destructive`**; pages/modals use `<BaseButton>` | `components/shared/BaseButton.tsx` (`ButtonVariant` line 6; `variantClasses` lines 20-30) | ❌ → ✅ Fixed | Added `destructive` variant (same classes as `danger`); kept `danger` as a non-breaking alias. No `variant="danger"` call sites exist, so nothing breaks. |
| 2b | `BaseBadge` exists with color variants | `components/shared/BaseBadge.tsx` (`BadgeVariant`: default/primary/success/warning/danger) | ✅ Compliant | None |
| 2c | `BaseModal` exists as reusable shell; wraps form modals + `CardDetailModal` | `components/shared/BaseModal.tsx`; `CardDetailModal.tsx:356-408` | ✅ Compliant | None. `BaseModal` exists and wraps `CardDetailModal`. No board/column/card creation modals use raw modal markup. |
| 3a | `useDragAndDrop` uses native HTML5 DnD (no lib), PATCH position on drop, optimistic update, rollback on error | `hooks/useDragAndDrop.ts` (native `onDragStart`/`onDragOver`/`onDrop`; `patch("/api/v1/cards/${cardId}/position", …)` at 46; `OPTIMISTIC_MOVE` then `ROLLBACK` on catch) | ✅ Compliant | None. URL `/api/v1/cards` matches the real backend (cards blueprint is mounted under `/api/v1`). |
| 3b | `useNotifications` polls `GET /api/notifications` every 30000 ms; `NotificationBell` shows unread count | `hooks/useNotifications.ts` (`POLL_INTERVAL_MS = 30_000`; `get("/api/notifications", {token})`); `components/shared/NotificationBell.tsx` | ✅ Compliant | None |
| 3c | `useErrorHandler` maps `ApiError` status → react-hot-toast | `hooks/useErrorHandler.ts` (`STATUS_MESSAGES`; `resolveErrorMessage`; `handleError` → `showError`) | ✅ Compliant | None |
| 4a | `apiClient` typed wrapper; base URL from `NEXT_PUBLIC_API_BASE_URL` (client) / `API_BASE_URL` (server); Bearer when token; throws `ApiError` (statusCode + message) on non-2xx | `lib/apiClient.ts` (`resolveBaseUrl`; `Authorization: Bearer ${token}`; `throw apiError`) | ✅ Compliant | None |
| 4b | `errors.ts` defines `ApiError` with `statusCode` + `message` | `lib/errors.ts` (`class ApiError`) | ✅ Compliant | None |
| 4c | `toast.ts` wraps `toast.success()`, `toast.error()`, **and `toast.loading()`** | `lib/toast.ts` (`showSuccess`; `showError`; `showInfo`; **no `showLoading`**) | ❌ → ✅ Fixed | Added `showLoading` wrapping `toast.loading`; added named re-exports `success`/`error`/`loading`; kept existing `showSuccess`/`showError`/`showInfo`. |
| 5 | Build & Test verification: lint exit 0; build exit 0; zero `waitForTimeout` calls; 4 auth + 8 kanban scenarios | `package.json` scripts; `e2e/tests/*.spec.ts` | ✅ Compliant | See verification results below. |

## Files changed

1. `components/shared/BaseButton.tsx` — added `destructive` variant (alias of `danger`).
2. `lib/toast.ts` — added `showLoading` and named re-exports (`success`/`error`/`loading`).

No other files were modified. (Item 1f `/my-tasks` was already compliant — `?assignee=me`
already present at `MyTasksList.tsx:47` — so no change was required despite the commit message
naming it.)

## Verification results (run after fixes, from `c:\Users\aldid\modulAIdevelopment\frontend`)

### Lint

Command: `npm run lint` (project script runs `eslint`; Next.js 16 removed `next lint`).

- **Exit code: 0**
- 0 errors, 11 warnings. All 11 warnings are **pre-existing** (unused `eslint-disable`
  directives, unused imports in `app/page.tsx`, `MyTasksList.tsx`, `BoardCard.test.tsx`, and one
  `react-hooks/exhaustive-deps` in `useCardSearch.ts`) and are unrelated to this audit's two
  fixes. The additive `toast.ts` re-exports introduced no new warnings.

### Build

Command: `npm run build` (project script runs `next build`).

- **Exit code: 0**
- "Compiled successfully in 1275ms" (Turbopack); TypeScript finished; 7 routes generated.
- `/` and `/boards/[id]` are Dynamic (Server Components, as required); `/login`, `/register`,
  `/profile`, `/my-tasks`, `/_not-found` are Static shells.

### waitForTimeout grep

Command (PowerShell):
```powershell
Select-String -Path "c:\Users\aldid\modulAIdevelopment\e2e\tests\*.spec.ts" -Pattern "waitForTimeout"
```

- Literal-string matches: **1** — `kanban-journey.spec.ts:12`, a docstring comment
  (`*   - Zero waitForTimeout() calls — all waiting is implicit via Playwright's ...`).
  This is a comment mentioning the name, which the checklist explicitly permits.
- Actual call pattern `\.waitForTimeout\(` matches: **0**.
- **Zero actual `waitForTimeout()` calls.** ✅

### E2E coverage (read-only confirmation)

- `e2e/tests/auth.spec.ts` — **4 `test(...)` blocks**: (1) valid login redirects to `/`,
  (2) invalid credentials show an error, (3) unauthenticated access to protected route
  redirects to `/login`, (4) after logout, navigating to `/` redirects to `/login`. ✅
- `e2e/tests/kanban-journey.spec.ts` — **8 numbered steps** in one sequential test:
  (1) create board, (2) add two columns, (3) add a card, (4) open `CardDetailModal`,
  (5) add a comment, (6) edit the comment + assert timestamp changed, (7) delete comment + card,
  (8) drag a card column-to-column and assert it persists after reload. ✅

## Notes (out-of-scope observations, not fixed — flagged for awareness)

- **Env-var name mismatch (latent runtime bug, not a checklist item):** `lib/apiClient.ts`
  reads `NEXT_PUBLIC_API_BASE_URL` / `API_BASE_URL` (the names in `.env.example`), but several
  raw-`fetch` files (`context/AuthContext.tsx`, `app/profile/page.tsx`,
  `components/board/MyTasksList.tsx`, `components/board/BoardsGrid.tsx`,
  `components/board/BoardDetailView.tsx`) read `process.env.NEXT_PUBLIC_API_URL`, which is not
  defined in `.env.example`. When that var is unset those fetches become relative and silently
  miss the Flask origin. This is outside this audit's checklist; recommendation: align those
  files on `NEXT_PUBLIC_API_BASE_URL` in a separate task.
- **Backend URL prefixing:** the backend mounts `cards_bp` and `columns_bp` under `/api/v1/...`
  and every other blueprint under `/api/...`. Therefore `useDragAndDrop.ts` calling
  `PATCH /api/v1/cards/<id>/position` is correct and matches the real backend, even though the
  checklist prose says `/api/cards/<id>/position`. No change needed.
- **E2E vs. UI feature gaps:** `kanban-journey.spec.ts` references UI that the current components
  do not fully implement (a "Create board" modal, "add column", comment edit/delete buttons,
  card "Open"/"Delete" buttons, `draggable` cards). `CommentList.tsx` is presentational-only and
  `BoardDetailView.tsx` does not wire `useDragAndDrop`. These are feature gaps, not checklist
  violations (the checklist only requires the hook and the tests to exist and be
  `waitForTimeout`-free), so they are out of scope here.

## Definition of Done

- [x] Relevant checklist items audited against actual files.
- [x] Genuine gaps fixed (BaseButton `destructive`, `toast.showLoading`).
- [x] No new npm packages added; `package.json` unchanged.
- [x] No business logic changed; existing behavior preserved.
- [x] `npm run lint` exits 0 (0 errors).
- [x] `npm run build` exits 0 (compiled successfully).
- [x] Zero actual `waitForTimeout()` calls in E2E tests.
- [x] E2E covers 4 auth scenarios and 8 kanban steps.
- [x] Audit report written.
