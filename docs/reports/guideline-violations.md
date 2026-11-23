# Guideline Violation Report: RevoTask

This report lists the guideline violations I could confirm in the AI-generated code and artifacts in the RevoTask repository. It follows `.kiro/steering/structure.md` §4 and §8: each entry gives the guideline that was violated, what the AI actually produced, and the correction that was applied (or is still needed). The report was rewritten from scratch and replaces the earlier version (see V-029).

Audit basis: git `HEAD` is `b9cf8d1`. The working tree only had untracked files under `.agents/` (`git status --short`). No tests, lint or build were re-run for this audit. Findings marked "(report)" come from existing agent reports and were not re-verified by running anything. No secret values are shown. Where a secret exists, only its location is given and the value is redacted.

## 1. Summary

31 violations are recorded. Every number below was recounted from the entries in section 3.

| Status                               | Count |
| ------------------------------------ | ----: |
| Fixed (checked against current code) |    12 |
| Partially fixed                      |     2 |
| Open                                 |    17 |

| Severity | Count |
| -------- | ----: |
| High     |     5 |
| Medium   |    13 |
| Low      |    13 |

| Area                | Count |
| ------------------- | ----: |
| frontend            |     6 |
| backend             |     4 |
| security            |     7 |
| api-contract        |     3 |
| structure           |     5 |
| testing             |     3 |
| workflow (build/CI) |     2 |
| docs                |     1 |

| Where the finding came from                                                  |                   Count |
| ---------------------------------------------------------------------------- | ----------------------: |
| Lint/build tooling run against AI code (report)                              | 3 (V-001, V-002, V-003) |
| AI review of AI code (`backend-review.md/.json`, `frontend-audit-report.md`) |      5 (V-004 to V-008) |
| Direct inspection of code and config during this audit                       |                      23 |

Severity levels: High means a security hole or broken functionality. Medium means a deviation from the guidelines that affects maintainability, the API contract or testing. Low means cosmetic, documentation or file-layout issues.

Twelve of the 31 findings are fixed and two are partly fixed. The other 17 are open, including 2 of the 5 High findings (V-009, V-011). The fixed High findings are V-003, V-010 and V-031. V-012, V-017 and V-031 were fixed and V-014 was partly fixed after the audit commit. The fixes after the audit commit are in `97e4c46` (V-012, V-014, V-031) and `87f1f40` (V-017). V-010 is fixed in the working tree and not committed yet.

## 2. Method and evidence

1. Read all steering files in `.kiro/steering/` (structure, security, testing, architecture, development-workflow, api-contracts) and `guidelines/frontend.md`, `guidelines/backend.md`, `guidelines/database.md`.
2. Read the existing reports: `.agents/tasks/backend-review.md` and `.json`, `.agents/tasks/restructure-plan.md`, `.agents/tasks/swagger-report.md`, `frontend/.agents/tasks/eslint-fix-report.md`, `frontend/.agents/tasks/frontend-audit-report.md`.
3. Used `git log`, `git log -S` and `git show --stat` to confirm the fix commits and to check whether the "before" code ever existed in history.
4. Opened the files in `backend/app`, `frontend`, `e2e`, `.github/workflows` and `.env.example` and checked each path:line cited here against them.

Guideline references use two forms. `guidelines/<file>.md "<title>"` points to a project guideline, which has no section numbers, so it is cited by title. `<steering>.md §N` points to a numbered steering file. The earlier report cited numbers such as `backend.md §3`, which do not match the content of the files, so they are no longer used.

## 3. Index

| ID    | Area         | Severity | Title                                                                                           | Status              | Source                      |
| ----- | ------------ | -------- | ----------------------------------------------------------------------------------------------- | ------------------- | --------------------------- |
| V-001 | frontend     | Medium   | Synchronous `setState` inside `useEffect`                                                       | Fixed (`42a645b`)   | Lint (report)               |
| V-002 | frontend     | Medium   | `ref.current` written during render                                                             | Fixed (`42a645b`)   | Lint (report)               |
| V-003 | workflow     | High     | `next build` failed to prerender `/`                                                            | Fixed (`2f2e508`)   | Build (report)              |
| V-004 | backend      | Low      | Analytics counted soft-deleted cards                                                            | Fixed (`dd8e301`)   | Review                      |
| V-005 | backend      | Low      | `BoardColumn` docstring said "integer" for a Float                                              | Fixed (`dd8e301`)   | Review                      |
| V-006 | security     | Medium   | `timezone` field had no IANA validation                                                         | Fixed (`dd8e301`)   | Review                      |
| V-007 | backend      | Low      | Duplicate `per_page` cap (dead code)                                                            | Fixed (`dd8e301`)   | Review                      |
| V-008 | frontend     | Low      | `BaseButton` had no `destructive` variant, `toast` had no `showLoading`                         | Fixed (`6f260ff`)   | Audit checklist             |
| V-009 | api-contract | High     | Backend has no `/api/auth/refresh` or `/api/auth/logout` (no session restore, no server logout) | Open                | Inspection                  |
| V-010 | security     | High     | Refresh token written through `document.cookie` (not HttpOnly)                                  | Fixed (uncommitted) | Inspection                  |
| V-011 | security     | High     | No rate limiting                                                                                | Open                | Inspection                  |
| V-012 | security     | Medium   | CORS not configured in code                                                                     | Fixed (`97e4c46`)   | Inspection                  |
| V-013 | security     | Medium   | Password hashing is not explicitly Argon2id or bcrypt                                           | Open                | Inspection                  |
| V-014 | security     | Low      | Default secret and DB URL in `DevelopmentConfig`                                                | Partial             | Inspection                  |
| V-015 | backend      | Low      | Ad-hoc 401 response copied four times in the auth decorator                                     | Open                | Inspection                  |
| V-016 | frontend     | Medium   | Direct `fetch()` in components, hooks and context                                               | Open                | Inspection                  |
| V-017 | frontend     | Medium   | `NEXT_PUBLIC_API_URL` missing from `.env.example`                                               | Fixed (`87f1f40`)   | Inspection (+ audit report) |
| V-018 | structure    | Medium   | Frontend has no `features/` or `lib/api/`                                                       | Open                | Inspection                  |
| V-019 | api-contract | Medium   | Inconsistent API prefix (`/api` vs `/api/v1`)                                                   | Open                | Inspection                  |
| V-020 | api-contract | Low      | JSON naming, pagination meta and error codes differ from api-contracts                          | Open                | Inspection                  |
| V-021 | structure    | Low      | `common/` lacks `permissions.py`, `responses.py`, `logging.py`                                  | Open                | Inspection                  |
| V-022 | structure    | Low      | `schema.py` instead of `schemas.py`                                                             | Open                | Inspection                  |
| V-023 | structure    | Low      | `backend/app/.env.example` is outside the target structure                                      | Open                | Inspection                  |
| V-024 | testing      | Medium   | Backend tests are flat, no `api/`, `integration/`, `security/`                                  | Open                | Inspection                  |
| V-025 | testing      | Medium   | Frontend tests cover only two components                                                        | Open                | Inspection                  |
| V-026 | testing      | Medium   | E2E has no Page Objects and no boards/cards specs                                               | Open                | Inspection (+ audit report) |
| V-027 | workflow     | Low      | CI: `npx next lint`, workflow name, e2e dependencies                                            | Open                | Inspection (+ report)       |
| V-028 | structure    | Low      | Duplicate documents (`VIOLATION_REPORT.md`, `.kiro/specs` vs `specs`)                           | Open                | Inspection                  |
| V-029 | docs         | Medium   | Earlier violation report contained claims that cannot be verified                               | Partial             | Inspection                  |
| V-030 | frontend     | Low      | Unused imports and misleading comments                                                          | Open                | Inspection (+ report)       |
| V-031 | security     | High     | `wsgi.py` uses `DevelopmentConfig`; `ProductionConfig` is never used                            | Fixed (`97e4c46`)   | Inspection                  |

## 4. Entries

Each entry has the same fields: area and severity, guideline, what happened, evidence, and status or fix.

### Fixed

#### V-001: Synchronous `setState` inside `useEffect`

Area / severity: frontend / Medium. Found by `react-hooks/set-state-in-effect` (report).

Guideline: `guidelines/frontend.md "No setState Calls in useEffect Render Phase"`.

The AI-written components called `setState` directly inside effects. `frontend/.agents/tasks/eslint-fix-report.md` (FIX 3 to FIX 6) records the pattern in `BoardDetailView`, `BoardsGrid`, `MyTasksList` and `CardDetailModal`. The "before" code cannot be viewed directly, because git only holds the fix diff.

Fix: commit `42a645b` (6 files: `BoardDetailView.tsx`, `BoardsGrid.tsx`, `CardDetailModal.tsx`, `MyTasksList.tsx`, `useCardSearch.ts`, `useDragAndDrop.ts`). The auth error is now derived during render, and `setState` is only called in async callbacks. Comment state moved to a reducer.

Checked in current code: `BoardDetailView.tsx:165`, `BoardsGrid.tsx:81` and `MyTasksList.tsx:178` use `if (!isAuthLoading && !token)`. `CardDetailModal.tsx:280` uses `useReducer`.

#### V-002: `ref.current` written during render

Area / severity: frontend / Medium. Found by `react-hooks/refs` (report).

Guideline: none of `guidelines/*.md` covers this directly. It breaks a React rule enforced by the project lint config, and falls under `development-workflow.md` Stage 6 (ESLint must be clean).

Evidence: `eslint-fix-report.md` (FIX 1 and FIX 2).

Fix: commit `42a645b`. The assignments are now wrapped in `useEffect` (`useCardSearch.ts:116-118`, `useDragAndDrop.ts:261-263`). `eslint-fix-report.md` still lists a `react-hooks/exhaustive-deps` warning in `useCardSearch.ts` (report).

#### V-003: `next build` failed to prerender

Area / severity: workflow / High. Found by running the build (report).

Guideline: `development-workflow.md` §3 Stage 6, `testing.md` §14.2 (build verification), `structure.md` §15.

The build exited with code 1 because prerendering `/` failed in `context/AuthContext.tsx:64`. This is recorded in the "next build Full Output" section of `eslint-fix-report.md`.

Fix: commit `2f2e508` (`frontend/app/page.tsx`, `frontend/app/boards/[id]/page.tsx`, `frontend/next.config.ts`). `app/page.tsx:12` then had `export const dynamic = "force-dynamic"`. That page has since been replaced by a client-driven shell and no longer sets it; prerendering `/` succeeds again (build run in the auth redirect fix). `frontend-audit-report.md` records exit 0 afterwards (report, not re-run here).

#### V-004: Analytics counted soft-deleted cards

Area / severity: backend / Low. Found in review (`.agents/tasks/backend-review.md`, Issue 1).

Guideline: `guidelines/database.md` and `architecture.md` on data integrity (`deleted_at` marks deletion). No specific section number applies.

Status: fixed. `backend/app/blueprints/analytics/service.py:36` now filters on `Card.deleted_at == None`. `git log -S` shows the string first appears in `dd8e301`, the same commit that created the blueprint, so there is no separate fix commit.

#### V-005: `BoardColumn` docstring said "integer"

Area / severity: backend / Low. Found in review (Issue 2).

Status: fixed. `backend/app/models/board_column.py:44` now reads "Zero-based float ...". The change is part of `dd8e301`.

#### V-006: `timezone` field had no IANA validation

Area / severity: security / Medium. Found in review (Issue 3).

Guideline: `security.md` §5 (backend input validation).

Status: fixed. `backend/app/blueprints/users/schema.py:10-26` validates against `zoneinfo.available_timezones()`. Part of `dd8e301`.

#### V-007: Duplicate `per_page` cap

Area / severity: backend / Low. Found in the Details section of the review, not in its Issues list.

Guideline: `development-workflow.md` §3 Stage 5, item 10 (no dead code).

Status: fixed. The cap now lives only in `notifications/routes.py:58`. `notifications/service.py:21` has a comment saying the route enforces it. Part of `dd8e301`.

#### V-008: `BaseButton` had no `destructive` variant, `toast` had no `showLoading`

Area / severity: frontend / Low. Found by the audit checklist (`frontend-audit-report.md`, items 2a and 4c). The checklist comes from the task spec, not from a steering rule.

Status: fixed in `6f260ff`. `components/shared/BaseButton.tsx:5` has the `destructive` variant and `lib/toast.ts:24` exports `showLoading`.

#### V-010: Refresh token written through `document.cookie`

Area / severity: security / High.

Guideline: `security.md` §3.3 (`HttpOnly`, `Secure`, `SameSite` cookies) and §9.

Before: `frontend/context/AuthContext.tsx` wrote `refresh_token` to a cookie from JavaScript after login, with a TODO to move it to `Set-Cookie`. The backend never read it. Scripts could read the cookie (exposed to XSS) and it had no `Secure` flag.

Status: fixed (uncommitted). `login()` no longer writes any cookie and `logout()` no longer clears one. The backend still returns `refresh_token` in the JSON body (`auth/routes.py:111`) and the frontend ignores it. Nothing is stored in cookies, `localStorage` or `sessionStorage`; the access token is kept in memory only. Tests in `frontend/context/__tests__/AuthContext.test.tsx` check that `document.cookie` is unchanged and that both web storages stay empty after login. These are jest/jsdom tests, not a real browser check. If a refresh token is needed later, the backend should set it as an HttpOnly cookie with CSRF protection (`security.md` §7).

#### V-012: CORS not configured in code

Area / severity: security / Medium.

Guideline: `security.md` §8.

Before: `.env.example` and `backend/app/.env.example` defined `CORS_ALLOWED_ORIGINS`, but `backend/app` had no CORS code and `requirements.txt` had no flask-cors.

Status: fixed in `97e4c46`. `flask-cors==6.0.5` is pinned and `create_app` (`backend/app/__init__.py`) allows only the origins in `CORS_ALLOWED_ORIGINS`, for `/api/*`, with the methods GET, POST, PUT, PATCH, DELETE, OPTIONS and the headers `Content-Type` and `Authorization`. Credentials are off because auth uses the Bearer header and the backend sets no cookies. Production refuses `*` and origins without `http(s)://`. Tests: `backend/tests/api/test_cors_health.py` (allowed and disallowed preflight, no wildcard, unlisted header) and `backend/tests/unit/test_config.py`.

#### V-031: `wsgi.py` uses `DevelopmentConfig`; `ProductionConfig` is unused

Area / severity: security / High.

Guideline: `security.md` §16 ("Disable debug mode in production") and §19, and `development-workflow.md` §6 ("Validate required environment variables at application startup").

Before: `wsgi.py` called `create_app()`, whose default was `DevelopmentConfig` (`DEBUG = True`), and `ProductionConfig._validate` was never called.

Status: fixed in `97e4c46`. `create_app` now picks the config with `get_config_object()` in `backend/app/config.py`. It reads `APP_ENV`, then `FLASK_ENV`, and uses `ProductionConfig` when neither is set. An unknown value raises `RuntimeError`. `ProductionConfig` has `DEBUG = False` and checks its variables in `init_app`, which `create_app` calls. Tests: `backend/tests/unit/test_config.py` (default is production, debug off, startup fails without each required variable). Importing `wsgi` with dummy variables gave `DEBUG` False.

#### V-017: `NEXT_PUBLIC_API_URL` was read but never defined

Area / severity: frontend / Medium.

Guideline: `guidelines/frontend.md "Centralised API Service Modules"` (base URL from env) and `structure.md` §9.1.

Before: six files read `NEXT_PUBLIC_API_URL ?? ""` (`context/AuthContext.tsx`, `app/profile/page.tsx`, `BoardDetailView.tsx`, `BoardsGrid.tsx`, `MyTasksList.tsx`, `hooks/useCardSearch.ts`), while `apiClient.ts` and both `.env.example` files used `NEXT_PUBLIC_API_BASE_URL`. The variable was never defined, so those URLs were relative and did not reach Flask. `frontend-audit-report.md` (Notes) records the same problem.

Status: fixed in `87f1f40`. The six files now read `NEXT_PUBLIC_API_BASE_URL`, and `frontend/.env.example` says the value is the backend origin without `/api`. The direct `fetch()` calls remain (V-016). Checked with `npm run lint`, `npx tsc --noEmit`, `npm run build` and `npx jest`; no test exercises these fetches against a real backend.

### Partially fixed

#### V-029: Earlier violation report contained claims that cannot be verified

Area / severity: docs / Medium. The sources are the old `docs/reports/guideline-violations.md` and its copy `VIOLATION_REPORT.md` (commit `3852262`, 295 lines each).

Guideline: `structure.md` §4 item 7 and §8 ("Evidence MUST be based on actual generated code, reviews, tests, or repository changes").

The old report listed violations that git history does not support:

- "Business Logic in Route Handler": `backend/app/blueprints/comments/routes.py` has one commit (`1611bb9`) and its diff has no `db.session`. The route today only delegates to the service. The "before" version is not in git.
- "Wrong Column Type (Integer)": `backend/app/models/card.py` has one commit (`4bd1d4f`) and already uses a Float `order` (`card.py:109`). No Integer-to-Float change is recorded.
- "Raw `<button>`": `git log -S"<button"` on `frontend/app/login/page.tsx` and `register/page.tsx` returns no commits.
- It cited section numbers such as `backend.md §3`, `frontend.md §4.8` and `database.md §11`, but `guidelines/*.md` have no numbers. It also cited `database.md` as if it banned floats for ordering, while `guidelines/database.md:44` requires a Float column named `order`. It also mentioned a "rubric".

Status: partial. This document replaces the content of `docs/reports/guideline-violations.md`. `VIOLATION_REPORT.md` in the repo root still holds the old text and was not changed (outside the scope of this task).

The WRONG/CORRECT examples in `guidelines/backend.md` and `guidelines/frontend.md` are illustrations. They are not counted as real violations here because there is no evidence of them in git history.

Recommended: delete `VIOLATION_REPORT.md` or replace it with a pointer to this file. Also check `docs/reports/ai-output-comparison.md`, which was not audited (see section 7).

#### V-014: Default secret and DB URL in `DevelopmentConfig`

Area / severity: security / Low.

Guideline: `security.md` §2 item 8 and §19 item 1.

`DevelopmentConfig` in `backend/app/config.py` still has local defaults for `JWT_SECRET_KEY`, `SECRET_KEY` and `DATABASE_URL` (values redacted). `TestingConfig` uses a literal key meant only for tests. No `.env` file is tracked (`git ls-files` shows only `.env.example`).

Status: partial (`97e4c46`). `ProductionConfig` no longer has any default for `SECRET_KEY`, `JWT_SECRET_KEY` or `DATABASE_URL`, and startup fails with a message that names the missing variable. Production is also the default when `APP_ENV` is unset (V-031), so the development defaults are only used when someone sets `APP_ENV=development`. The defaults in `DevelopmentConfig` were kept on purpose for local work.

### Open

#### V-009: Auth endpoints called by the frontend do not exist

Area / severity: api-contract / High.

Guideline: `api-contracts.md` §3.3, §4.3 (`/auth/logout`) and §16.3 (contract consistency). `security.md` §3.3 (sessions must be revocable on logout).

The frontend no longer calls the missing endpoints (see the fix note below). The real gap is on the backend: `backend/app/blueprints/auth/routes.py` only registers `/register` (line 10) and `/login` (line 58). A `refresh_token` model exists (`backend/app/models/refresh_token.py`) and login issues the token (`auth/service.py`), but no route can use or revoke it.

Impact: there is no session restore, so a page reload logs the user out and the token cannot be renewed after 15 minutes (`auth/service.py`). There is also no server-side logout: logout only clears client state and the access token stays valid until it expires.

Frontend change (uncommitted): `AuthContext` no longer calls `/api/auth/refresh` on mount or `/api/auth/logout`. This also removes the CORS error those calls caused in the browser console. It does not close this violation.

Recommended: add refresh (with rotation) and logout routes with tests, then restore session restore and logout in the frontend.

#### V-011: No rate limiting

Area / severity: security / High.

Guideline: `security.md` §3.1 and §11 (login, registration).

A grep for `Limiter|limiter` in `backend/app` returns nothing, and `backend/requirements.txt` does not list Flask-Limiter.

Recommended: rate limit `/api/auth/login` and `/register` using shared storage, not per-process counters (`security.md` §11).

#### V-013: Password hashing is not explicitly Argon2id or bcrypt

Area / severity: security / Medium.

Guideline: `security.md` §3.2.

`backend/app/blueprints/auth/service.py:53` calls Werkzeug's `generate_password_hash(password)` with the default method and no explicit settings. I did not run code to check what the default is in the installed version.

Recommended: use Argon2id or bcrypt with documented parameters.

#### V-015: Ad-hoc 401 response copied in the auth decorator

Area / severity: backend / Low.

Guideline: `guidelines/backend.md "Typed Exception Hierarchy"` (failures should use `AppException`, not ad-hoc responses).

`backend/app/blueprints/auth/decorators.py` builds the same `jsonify({"error": ...}), 401` block four times, at lines 34-43, 56-65, 69-78 and 85-94. `UnauthorizedError` already exists in `common/exceptions.py:61`.

Recommended: `raise UnauthorizedError()` and let `error_handlers.py` format the response.

#### V-016: Direct `fetch()` in components, hooks and context

Area / severity: frontend / Medium.

Guideline: `guidelines/frontend.md "Centralised API Service Modules"`, `api-contracts.md` §3.3 and §13.1, `architecture.md` §7.1.

Direct `fetch(` calls are at `context/AuthContext.tsx:70` (login only), `app/profile/page.tsx:28`, `components/board/MyTasksList.tsx:46` and `hooks/useCardSearch.ts:70`. The shared client `lib/apiClient.ts` already exists and is used in `components/board/BoardsGrid.tsx`, `components/board/BoardDetailView.tsx`, `useDragAndDrop.ts:3`, `useNotifications.ts:3` and `CardDetailModal.tsx:5`, so usage is inconsistent.

#### V-018: Frontend has no `features/` or `lib/api/`

Area / severity: structure / Medium.

Guideline: `guidelines/frontend.md "Feature Folder Structure"`, `structure.md` §5 and §5.5, `api-contracts.md` §13.1.

`frontend/features`, `frontend/lib/api`, `frontend/providers` and `frontend/tests` do not exist. The code uses `frontend/context/`, `frontend/lib/apiClient.ts` and `frontend/components/board/`, and the routes have no `(auth)/(dashboard)` groups. `restructure-plan.md` says "no structural changes" for the frontend, so this was never addressed.

Recommended: migrate in small steps as `structure.md` §13 describes, not in one move.

#### V-019: Inconsistent API prefix

Area / severity: api-contract / Medium.

Guideline: `api-contracts.md` §3.2 and §15 (`/api/v1`).

`backend/app/__init__.py:87-88` registers `/api/v1/cards` and `/api/v1/columns`, while lines 89-97 use `/api/...`. A comment above line 87 admits this is technical debt. The frontend mixes both: `useDragAndDrop.ts` uses `/api/v1/cards/...` and `MyTasksList.tsx:46` uses `/api/cards`.

#### V-020: JSON naming, pagination meta and error codes

Area / severity: api-contract / Low.

Guideline: `api-contracts.md` §5.2 (camelCase), §6.2 (`meta.pagination.perPage`), §7.2 (`UNAUTHENTICATED`).

`backend/app/blueprints/cards/schema.py:74,80` returns `column_id` and `created_at`. `notifications/routes.py:62` returns `"meta": {"page", "per_page", "total"}`. `common/exceptions.py:65` uses the code `UNAUTHORIZED`.

`guidelines/backend.md "Standard Response Envelope"` shows `meta` with `per_page`, so the project guideline and `api-contracts.md` contradict each other. This needs a decision under `structure.md` §4 item 5.

#### V-021: `common/` is incomplete

Area / severity: structure / Low.

Guideline: `structure.md` §6 and §6.3.

`backend/app/common/` holds only `__init__.py`, `error_handlers.py` and `exceptions.py`. `permissions.py`, `responses.py` and `logging.py` are missing, and so is `utils/`. Ownership checks are spread across the services of each blueprint.

#### V-022: `schema.py` instead of `schemas.py`

Area / severity: structure / Low.

Guideline: `structure.md` §6.1 (file name `schemas.py`).

Every blueprint (`backend/app/blueprints/*/schema.py`) uses `schema.py`.

#### V-023: `backend/app/.env.example` is outside the structure

Area / severity: structure / Low.

Guideline: `structure.md` §2 and §9.1 (one `.env.example` in the root).

`backend/app/.env.example` is tracked, alongside the root `.env.example` and `frontend/.env.example`. It contains only variable names and placeholders.

#### V-024: Backend tests do not follow the standard layout

Area / severity: testing / Medium.

Guideline: `testing.md` §12.1, §6.3, §8, §20, and `structure.md` §6.

`backend/tests/` contains only `conftest.py`, `test_auth_service.py`, `test_cards_service.py` and `test_comments.py`. There is no `unit/`, `integration/`, `api/` or `security/`. HTTP-level 401/403/404 tests exist only in `test_comments.py` (lines 92 and 118). There are no route tests for auth, boards, columns, notifications, analytics or users, and no migration tests. The tests were not re-run for this audit.

#### V-025: Minimal frontend test coverage

Area / severity: testing / Medium.

Guideline: `testing.md` §5.3 and §5.4.

The only tests are `frontend/components/board/__tests__/BoardCard.test.tsx` and `CommentList.test.tsx`. Nothing covers `lib/apiClient.ts` or the hooks. `AuthContext` now has tests in `frontend/context/__tests__/AuthContext.test.tsx` (uncommitted).

#### V-026: E2E has no Page Objects and no boards/cards specs

Area / severity: testing / Medium.

Guideline: `structure.md` §7 (item 2: Page Objects MUST be used) and `testing.md` §10.

The tracked e2e files are `e2e/fixtures/auth.setup.ts`, `e2e/playwright.config.ts`, `e2e/tests/auth.spec.ts` and `e2e/tests/kanban-journey.spec.ts`. There is no `e2e/pages/`, `boards.spec.ts` or `cards.spec.ts`. `frontend-audit-report.md` (Notes) says the kanban spec refers to UI that is not fully implemented (report, not re-verified). No `waitForTimeout` call was found; the only match is a comment in `kanban-journey.spec.ts:12`.

#### V-027: CI lint command, workflow name and e2e dependencies

Area / severity: workflow / Low.

Guideline: `structure.md` §2 (`e2e-tests.yml`) and `testing.md` §14.2.

- `.github/workflows/frontend-ci.yml:15` runs `npx next lint`, while `frontend/package.json:9` uses `"lint": "eslint"`. `frontend-audit-report.md` and `eslint-fix-report.md` say Next.js 16 no longer provides `next lint` (report, not re-run).
- The e2e workflow is named `playwright.yml`, not `e2e-tests.yml`.
- The e2e job runs `npx playwright test` with `working-directory: e2e`, but no `package.json` for `e2e/` is tracked. Whether this works in CI cannot be confirmed without running the workflow.

#### V-028: Duplicate documents

Area / severity: structure / Low.

Guideline: `structure.md` §14 item 6 (avoid duplicates) and §2 (root layout).

`VIOLATION_REPORT.md` in the root is not in the `structure.md` §2 layout and is identical to the old version of this report (commit `3852262`). Both `.kiro/specs/*` and `specs/*` are tracked (`restructure-plan.md` says `specs/` was "copied from .kiro/specs/"). `.kiro/steering/development-workflow..md` has a double dot in its file name. Whether that is intentional is unknown.

#### V-030: Unused imports and misleading comments

Area / severity: frontend / Low.

Guideline: `development-workflow.md` §3 Stage 5 item 10, and Stage 7 ("remove unused imports").

`components/board/MyTasksList.tsx:6` imports `BaseButton`, while the comments at lines 150 and 237 say it is used. `eslint-fix-report.md` lists the unused import (report). `eslint-fix-report.md` records 11 lint warnings in total (report).

## 5. Open violations by priority

| Priority | IDs                                                    | Severity | Summary                                    |
| -------- | ------------------------------------------------------ | -------- | ------------------------------------------ |
| 1        | V-009                                                  | High     | Backend has no refresh or logout endpoints |
| 2        | V-011                                                  | High     | No rate limiting                           |
| 3        | V-013, V-016, V-018, V-019, V-024, V-025, V-026        | Medium   | See section 4                              |
| 4        | V-015, V-020, V-021, V-022, V-023, V-027, V-028, V-030 | Low      | See section 4                              |

17 entries are open (V-009, V-011, V-013, V-015, V-016, V-018 to V-028, V-030). V-014 and V-029 are partially fixed. V-029: this document replaces the old report text, and the root `VIOLATION_REPORT.md` was removed in commit `7810130`.

## 6. Checked, no violation found

- Route handlers contain no SQLAlchemy queries. A grep for `db.session|select(|.query(` in `backend/app/blueprints/*/routes.py` returned nothing, and `comments/routes.py` only validates and calls the service.
- No `.env` file is tracked, and `.gitignore` excludes `.env*` except `.env.example`.
- The 500 handler returns a generic message and logs the traceback (`common/error_handlers.py:82-97`).
- JWT verification uses an algorithm allowlist (`decorators.py:52`, `algorithms=["HS256"]`).
- The frontend code I read has no `localStorage`, `sessionStorage` or `dangerouslySetInnerHTML`.

## 7. Limitations

- No tests, lint or build were run for this audit. The lint, build and e2e results quoted here come from agent reports and were not re-checked.
- The "before" code for V-001 to V-008 is not fully available in git. The fixes for V-004 to V-007 went in with the feature commit `dd8e301`, so the only "before" evidence is the review report.
- The example violations in `guidelines/*.md` (a route with a DB query, a raw `<button>`, `Integer position`) could not be shown to have existed in git, so they are not recorded as violations.
- Not audited in depth: `docs/reports/ai-output-comparison.md` (its metrics were not verified), `specs/*` (traceability of requirements, design and tasks), `guidelines/database.md` apart from the Float rule, the Alembic migrations, the contents of the tests in `backend/tests/`, and UI components other than the ones cited.
- Not checked: accessibility, security headers (CSP, HSTS), end-to-end CSRF, and real deployment behavior (CI, hosting, reverse proxy).
- Some files under `.agents/` are untracked (`restructure-report.md`, `restructure-review.*`, `frontend-audit-plan.md`, `frontend-audit-review.*`). Nothing in them is used as evidence here.
