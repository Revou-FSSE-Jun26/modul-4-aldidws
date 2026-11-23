# Implementation Plan: Task Management Application

## Overview

Implement the full-stack Task Management Application in vertical slices, starting with the backend foundation (database models, auth, task/project CRUD) and then the frontend (Next.js pages and components). Property-based tests with Hypothesis are co-located with the backend logic they validate. End-to-end Playwright tests are written last, once both layers are complete.

## Tasks

---

### 1. Backend — Project Bootstrap and Database Foundation

- [ ] 1.1 Scaffold Flask application with factory pattern
  - Create `backend/app/__init__.py` with `create_app()` factory
  - Configure `SQLALCHEMY_DATABASE_URI`, `JWT_SECRET_KEY`, and other settings from environment variables via `python-dotenv`
  - Register blueprints for `auth`, `tasks`, `projects`, and `activity`
  - _Requirements: 10.1, 10.2, 11.1_

- [ ] 1.2 Implement structured logging middleware
  - Create `backend/app/middleware/logging.py`
  - Generate a `X-Request-ID` UUID per request (or echo the client-supplied header)
  - Emit structured JSON log lines with method, path, status code, duration, and request ID
  - Never log passwords, tokens, or personal data fields
  - _Requirements: 6.6_

- [ ] 1.3 Implement health-check endpoint
  - Create `backend/app/routes/health.py` exposing `GET /api/v1/health`
  - Return `200 { "status": "ok", "db": "ok" }` when app and database are reachable
  - Return `503` if the database connection fails
  - _Requirements: 11.1, 6.6_

- [ ] 1.4 Define SQLAlchemy models and Alembic migrations
  - Create `backend/app/models/user.py`, `task.py`, `project.py`, `activity.py`, `refresh_token.py` as described in the design ERD
  - Configure `User` with UUID PK, `email` unique index, `password_hash`, `timezone`, `role` (default `'member'`), `created_at`, `updated_at`
  - Configure `RefreshToken` with UUID PK, `user_id` FK, `token_hash` (SHA-256 of raw token, unique), `expires_at`, `revoked` (default `False`), `created_at`
  - Configure `Task` with the `order` column (not null, user-scoped sequential integer default), composite indexes on `(user_id, status)`, `(user_id, priority)`, `(user_id, due_date)`, and a PostgreSQL `tsvector` column updated by a trigger for full-text search
  - Configure `Project` with unique constraint `(user_id, lower(name))`
  - Configure `Activity` with `event_type`, `payload JSONB`, immutable after creation
  - Initialise Alembic; generate and test the initial migration
  - _Requirements: 10.1, 10.2, 10.8_

- [ ]\* 1.5 Write unit tests for SQLAlchemy model constraints
  - Verify unique constraint on `(user_id, lower(project_name))` raises `IntegrityError` on duplicate
  - Verify `Task.status` and `Task.priority` enum constraints reject invalid values at the DB layer
  - Verify `RefreshToken.token_hash` unique constraint raises `IntegrityError` on duplicate
  - _Requirements: 2.10, 6.7, 7.4_

---

### 2. Backend — Authentication

- [ ] 2.1 Implement user registration and login services
  - Create `backend/app/services/auth_service.py`
  - `register_user(email, password)` — validate email format and password policy (≥8 chars, one upper, one lower, one digit), hash with `werkzeug.security.generate_password_hash` (PBKDF2-SHA256), persist `User`, return serialized user
  - `login_user(email, password)` — verify credentials using `werkzeug.security.check_password_hash` without revealing which field failed; issue access token (15 min TTL) and refresh token (7 days); store SHA-256 hash of raw refresh token in `refresh_tokens` table
  - `logout_user(refresh_token)` — set `revoked = True` on the matching `RefreshToken` record
  - `refresh_access_token(refresh_token)` — look up token by hash, reject if revoked or expired, issue new access token
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.8, 6.2 (security)_

- [ ] 2.2 Implement JWT middleware and auth routes
  - Create `backend/app/middleware/auth.py` — `require_auth` decorator that validates Bearer JWT, attaches `current_user` to `flask.g`, returns `401` on failure
  - Create `backend/app/routes/auth.py` exposing:
    - `POST /api/auth/register`
    - `POST /api/auth/login`
    - `POST /api/auth/logout`
    - `POST /api/auth/refresh` — exchange a valid refresh token for a new access token
  - All routes return envelope responses with appropriate HTTP status codes
  - _Requirements: 1.4, 1.5, 1.6, 1.7, 11.1, 11.2, 11.3, 11.6_

- [ ]\* 2.3 Implement role-based access control guard and Admin scaffold
  - Add `require_role(role)` decorator to `backend/app/middleware/auth.py`
  - Scaffold `backend/app/routes/admin.py` with a placeholder `GET /api/v1/admin/users` endpoint protected by `require_role('admin')`
  - Return `403` when a non-admin user accesses an admin-only endpoint
  - _Requirements: 3.3_

- [ ]\* 2.4 Write unit tests for auth service
  - Test password hashing round-trip: stored hash ≠ plaintext; `check_password_hash` passes with correct password
  - Test duplicate email registration returns validation error
  - Test invalid credentials do not reveal which field failed
  - Test expired and tampered JWTs return 401
  - Test revoked refresh token is rejected by `refresh_access_token`
  - _Requirements: 1.3, 1.5, 1.8_

---

### 3. Backend — Task CRUD

- [ ] 3.1 Implement task validation helpers
  - Create `backend/app/validators/task_validator.py`
  - Validate title (1–255 chars, non-blank after strip), description (≤2000 chars), status enum, priority enum, due_date ISO 8601
  - Return structured `ValidationError` with field-level details
  - _Requirements: 2.1, 2.5, 2.7, 2.8, 2.9, 2.10, 6.7_

- [ ]\* 3.2 Write property tests for task validation (Properties 3, 4, 5, 18)
  - **Property 3: Whitespace title rejection** — `@given(title=st.text(alphabet=string.whitespace, min_size=1))` → assert validator raises error
  - **Property 4: Title length enforcement** — generate titles of lengths 0, 1, 255, 256, 1000 → assert accept/reject boundary
  - **Property 5: Description length enforcement** — generate descriptions at and beyond 2000 chars → assert boundary
  - **Property 18: Enum enforcement** — generate arbitrary strings for status/priority → assert invalid values rejected
  - **Validates: Requirements 2.1, 2.5, 2.7, 2.8, 2.9, 2.10, 6.7**

- [ ] 3.3 Implement task service
  - Create `backend/app/services/task_service.py`
  - `create_task(user_id, payload)` — validate, set defaults (`status='todo'`, `priority='medium'`), assign ownership, set `order` to `MAX(order) + 1` for the user, persist, record activity event
  - `list_tasks(user_id, filters, sort, pagination)` — scope to `user_id`, apply status/priority/project/overdue/due_today filters, full-text search via tsvector, sort with deterministic secondary key chain (`order ASC`, then `created_at DESC`), paginate
  - `get_task(user_id, task_id)` — scope to `user_id`, return 404 if not found
  - `update_task(user_id, task_id, payload)` — validate, enforce ownership, detect stale update via `updated_at` check, persist, record activity
  - `delete_task(user_id, task_id)` — enforce ownership, delete, record activity
  - `reorder_tasks(user_id, order_pairs)` — validate all task IDs belong to `user_id`, bulk-update `order` values in a single transaction ensuring no two tasks share the same `order` value after the operation
  - _Requirements: 2.1–2.11, 3.1–3.8, 4.1–4.9, 5.1–5.5, 6.3, 6.4, 8.1–8.13, 9.1–9.7, 10.3, 10.6, 10.7, 12.1–12.3_

- [ ]\* 3.4 Write property tests for task service (Properties 1, 2, 6, 7, 8, 9, 10, 11, 12, 15, 17)
  - **Property 1: Task creation ownership** — `@given(valid_payload)` → assert returned task `user_id == creating_user_id`
  - **Property 2: Task creation defaults** — `@given(payload omitting status/priority)` → assert `status='todo'`, `priority='medium'`
  - **Property 6: Cross-user isolation** — create tasks as user A, list as user B → assert empty result regardless of filters
  - **Property 7: Filter AND semantics** — generate task sets + random filter combos → assert every result satisfies all active filters
  - **Property 8: Overdue filter correctness** — generate tasks with varied due dates and statuses → assert overdue set matches `due_date < today(tz) AND status != 'done'`
  - **Property 9: Due date sort — nulls last** — generate mixed null/non-null due dates → assert nulls appear after non-nulls
  - **Property 10: Priority sort order** — generate task sets → assert high > medium > low ordering holds
  - **Property 11: Update ownership enforcement** — attempt update/delete as non-owner → assert 403/404
  - **Property 12: Update preserves data on validation failure** — submit invalid update → assert stored task unchanged
  - **Property 15: Search case-insensitive** — create task with known substring; search with varied casing → assert task appears
  - **Property 17: Persistence before success** — after 2xx response → assert DB record reflects the change
  - **Validates: Requirements 2.2–2.4, 3.8, 4.6, 4.8, 5.5, 8.6, 8.9, 8.10, 8.13, 9.2, 9.3, 10.3, 10.6**

- [ ] 3.5 Implement task routes
  - Create `backend/app/routes/tasks.py`
  - Wire `GET /api/v1/tasks`, `POST /api/v1/tasks`, `GET /api/v1/tasks/<id>`, `PATCH /api/v1/tasks/<id>`, `DELETE /api/v1/tasks/<id>`
  - Wire `PATCH /api/v1/tasks/reorder` — accept body of `[{id, order}]` pairs, call `reorder_tasks`, return updated order positions
  - Apply `require_auth` decorator to all routes
  - Deserialize query parameters for `GET /tasks` (status, priority, project_id, overdue, due_today, q, sort, order, page, per_page)
  - Return envelope responses with appropriate HTTP status codes
  - _Requirements: 11.1–11.10_

- [ ]\* 3.6 Write property test for task reorder (Property 19)
  - **Property 19: Task order uniqueness per user** — generate reorder payloads with arbitrary `order` values; call `PATCH /api/v1/tasks/reorder`; assert no two tasks owned by that user share the same `order` value after the operation
  - **Validates: Requirements 9.1, 9.4, 9.5, 9.6**

- [ ]\* 3.7 Write integration tests for task CRUD routes
  - Full create → read → update → delete lifecycle, asserting DB state at each step
  - Cross-user isolation: as user B, `GET /tasks/<id>` owned by user A → 404
  - Stale update detection: submit update with outdated `updated_at` → 409
  - Reorder: verify `order` values are unique per user after `PATCH /api/v1/tasks/reorder`
  - Validation error envelope matches defined error structure
  - _Requirements: 2.1–2.11, 4.1–4.9, 5.1–5.5, 11.2, 11.3_

---

### 4. Backend — Project CRUD

- [ ] 4.1 Implement project service
  - Create `backend/app/services/project_service.py`
  - `create_project(user_id, name)` — validate name (1–100 chars, non-blank), check case-insensitive uniqueness per user, persist
  - `list_projects(user_id)` — scope to `user_id`
  - `get_project(user_id, project_id)` — scope to `user_id`, return tasks associated
  - `update_project(user_id, project_id, name)` — enforce ownership, validate, check uniqueness
  - `delete_project(user_id, project_id)` — within a single transaction: set all associated tasks' `project_id` to null, then delete the project
  - `assign_task_to_project(user_id, task_id, project_id)` — verify both task and project belong to `user_id`
  - _Requirements: 7.1–7.12, 10.3, 10.6, 10.7_

- [ ]\* 4.2 Write property tests for project service (Properties 13, 14)
  - **Property 13: Project name uniqueness (case-insensitive)** — generate name variants with different casing → assert second creation for same user rejected; creation for different user succeeds
  - **Property 14: Project deletion unassigns tasks atomically** — create project with N tasks; delete project → assert tasks survive with `project_id=null` and project is gone
  - **Validates: Requirements 7.4, 7.5, 7.9, 7.10, 7.11**

- [ ] 4.3 Implement project routes
  - Create `backend/app/routes/projects.py`
  - Wire `GET /api/v1/projects`, `POST /api/v1/projects`, `GET /api/v1/projects/<id>`, `PATCH /api/v1/projects/<id>`, `DELETE /api/v1/projects/<id>`
  - Apply `require_auth` to all routes
  - _Requirements: 7.1–7.12, 11.1–11.10_

- [ ]\* 4.4 Write integration tests for project CRUD routes
  - Create → list → update → delete lifecycle
  - Duplicate project name (same user, different cases) → 409
  - Same name for different user → 201
  - Delete project: verify tasks' `project_id` nullified and project removed in one transaction
  - Cross-user project access → 403/404
  - _Requirements: 7.1–7.12_

---

### 5. Backend — Activity Log

- [ ] 5.1 Implement activity service and routes
  - Create `backend/app/services/activity_service.py`
  - `record(user_id, task_id, event_type, payload)` — insert immutable activity record; called internally from task/project services
  - `list_activity(user_id, pagination)` — return activity log scoped to `user_id`
  - Create `backend/app/routes/activity.py` — wire `GET /api/v1/activity` with `require_auth`
  - _Requirements: 12.1–12.5_

- [ ]\* 5.2 Write unit tests for activity service (Property 16)
  - **Property 16: Activity record immutability** — after record creation, attempt any application-level update or delete → assert record unchanged and operation rejected
  - **Validates: Requirements 12.5**

---

### 6. Backend Checkpoint

- [ ] 6. Checkpoint — Ensure all backend tests pass
  - Run `pytest backend/tests/ -v` and confirm all unit, property, and integration tests pass.
  - Verify migrations apply cleanly on a fresh database.
  - Hit `GET /api/v1/health` and confirm `{"status": "ok", "db": "ok"}` is returned.
  - Verify structured JSON log output contains `request_id`, method, path, status, and duration fields.
  - Ask the user if any questions arise before proceeding to the frontend.

---

### 7. Frontend — Bootstrap and Auth

- [ ] 7.1 Scaffold Next.js application
  - Create `frontend/` with Next.js 14 (App Router), TypeScript, Tailwind CSS
  - Configure `@tanstack/react-query` QueryClient in a root provider
  - Configure `AuthContext` in `frontend/app/providers.tsx` storing decoded JWT claims and exposing `login` / `logout` helpers; persist access token in memory, refresh token in `httpOnly` cookie
  - Configure `axios` or `fetch` wrapper that injects `Authorization: Bearer <token>` header and handles silent refresh on 401 by calling `POST /api/auth/refresh`; if refresh fails, clear auth state and redirect to `/auth/login`
  - Add Zod-based API error parsing utility
  - _Requirements: 1.7, 11.11, 11.12_

- [ ] 7.2 Implement registration and login pages
  - Create `frontend/app/auth/register/page.tsx` and `frontend/app/auth/login/page.tsx`
  - Use `react-hook-form` with Zod schemas mirroring backend validation (email format, password policy)
  - On submit: call `POST /api/auth/register` or `POST /api/auth/login`; store tokens; redirect to dashboard
  - Display field-level validation errors; preserve form data on API failure (Requirement 11.12)
  - _Requirements: 1.1–1.5, 1.7, 3.5, 11.11, 11.12_

- [ ]\* 7.3 Write component tests for auth forms
  - Registration form: empty submit shows validation errors; duplicate email shows server error without clearing inputs
  - Login form: invalid credentials show non-disclosing error; successful login redirects to dashboard
  - _Requirements: 1.3, 1.5, 11.12_

---

### 8. Frontend — Task List and Core Components

- [ ] 8.1 Implement task list page and TaskCard component
  - Create `frontend/app/dashboard/page.tsx` — fetch `GET /api/v1/tasks` via React Query; render loading, empty, error, and populated states
  - Create `frontend/components/TaskCard.tsx` — display title, `StatusBadge`, `PriorityBadge`, due date, project name; visually distinguish completed tasks (Requirement 6.5) and priority levels (Requirement 6.6)
  - Create `frontend/components/StatusBadge.tsx` and `frontend/components/PriorityBadge.tsx`
  - Implement `frontend/components/Pagination.tsx` — render page controls; pass `page` and `per_page` to query
  - _Requirements: 3.1–3.8, 6.5, 6.6_

- [ ] 8.2 Implement TaskModal (create and edit form)
  - Create `frontend/components/TaskModal.tsx`
  - Fields: title (required), description (textarea), status select, priority select, due date picker, project select (optional)
  - Zod schema: title 1–255 chars; description ≤2000; status/priority enum; due date optional ISO date
  - `POST /api/v1/tasks` for create; `PATCH /api/v1/tasks/<id>` for edit; invalidate React Query cache on success
  - Merge `400` server validation errors into form state; preserve unsaved data on failure
  - _Requirements: 2.1–2.11, 4.1–4.9, 11.11, 11.12_

- [ ] 8.3 Implement task deletion with confirmation
  - Create `frontend/components/ConfirmDialog.tsx` — reusable modal with confirm/cancel
  - Wire delete button on `TaskCard` to show `ConfirmDialog`; on confirm call `DELETE /api/v1/tasks/<id>`; on success remove from React Query cache
  - Display error toast and retain task on API failure
  - _Requirements: 5.1–5.5_

- [ ]\* 8.4 Write component tests for TaskModal and ConfirmDialog
  - Creating a task: submit with empty title → validation error shown, form not submitted
  - Editing a task: server 400 → error merged into form, existing values retained
  - Deletion: cancel → task remains; confirm → task removed from list
  - _Requirements: 2.7, 2.8, 4.6, 4.7, 5.1–5.4_

---

### 9. Frontend — Filtering, Searching, and Sorting

- [ ] 9.1 Implement FilterBar and SortSelector components
  - Create `frontend/components/FilterBar.tsx` — status, priority, project, overdue, due today toggles; search input (1–100 chars); clear all button
  - Create `frontend/components/SortSelector.tsx` — dropdown for `due_date`, `priority`, `created_at`, `title` with `asc`/`desc`
  - Encode active filters and sort into URL query params via `next/navigation` `useRouter` / `useSearchParams`; React Query key includes params so list refetches on change
  - Display appropriate empty state when no tasks match (Requirement 8.12)
  - _Requirements: 8.1–8.13, 9.1–9.7_

- [ ]\* 9.2 Write component tests for FilterBar
  - Applying status + priority filter passes correct query params to API
  - Clearing filters resets query params and triggers refetch
  - Search with 101-char query shows validation error without calling API
  - _Requirements: 8.1–8.11, 8.13_

---

### 10. Frontend — Projects

- [ ] 10.1 Implement ProjectSidebar and project list
  - Create `frontend/components/ProjectSidebar.tsx` — list user's projects fetched via `GET /api/v1/projects`; click to navigate to `frontend/app/projects/[id]/page.tsx`
  - Project list page fetches `GET /api/v1/projects/<id>` and renders tasks for that project using `TaskCard`
  - Add inline create-project form in the sidebar (name field, 1–100 chars, non-blank); show 409 error when name is a duplicate
  - _Requirements: 7.1–7.8, 7.12_

- [ ] 10.2 Implement project deletion
  - Add delete button in project page header; show `ConfirmDialog`; call `DELETE /api/v1/projects/<id>`
  - On success: redirect to dashboard, invalidate projects and tasks React Query caches
  - Display error and retain project on failure
  - _Requirements: 7.9–7.11_

- [ ]\* 10.3 Write component tests for project pages
  - Create project: duplicate name → 409 error displayed; unique name → project appears in sidebar
  - Delete project: confirm → project removed and tasks survive on dashboard (project_id cleared)
  - _Requirements: 7.1–7.5, 7.9–7.11_

---

### 11. Frontend — Route Protection

- [ ] 11.1 Implement route guards and auth flow
  - Create `frontend/middleware.ts` — redirect unauthenticated users away from protected routes to `/auth/login`; redirect authenticated users away from `/auth/*` to `/dashboard`
  - Implement silent token refresh: on 401 response, call `POST /api/auth/refresh`; if that fails, clear auth state and redirect to `/auth/login`
  - Implement logout: call `POST /api/auth/logout`, clear tokens, redirect to `/auth/login`
  - _Requirements: 1.6, 1.7, 3.1_

- [ ]\* 11.2 Write integration tests for route protection
  - Unauthenticated request to `/dashboard` → redirects to `/auth/login`
  - Expired access token → silent refresh succeeds, page loads
  - Refresh token revoked → redirects to `/auth/login`
  - _Requirements: 1.6, 1.7_

---

### 12. Frontend Checkpoint

- [ ] 12. Checkpoint — Ensure all frontend tests pass
  - Run frontend component and integration tests; fix any failures.
  - Manually verify responsive layout on desktop, tablet, and mobile breakpoints.
  - Ask the user if any questions arise before proceeding to end-to-end tests.

---

### 13. End-to-End Tests (Playwright)

- [ ] 13.1 Write E2E tests for core user journeys
  - Register → login → create task → edit task → delete task
  - Create project → assign task to project → view project → delete project (verify tasks survive on dashboard)
  - _Requirements: 2.1–2.11, 4.1–4.9, 5.1–5.5, 7.1–7.12_

- [ ]\* 13.2 Write E2E tests for filtering, searching, and sorting
  - Apply status + priority + overdue filters simultaneously; verify UI matches expected results
  - Search with mixed casing; verify results appear
  - Sort by due date ascending; verify null due dates appear last
  - _Requirements: 8.1–8.13, 9.1–9.7_

- [ ]\* 13.3 Write E2E tests for auth and security flows
  - Logout → verify private routes redirect to `/auth/login`
  - Attempt to access another user's task URL directly → verify 404 or redirect
  - Invalid JWT in request → 401 returned
  - _Requirements: 1.6, 1.7, 3.8, 11.6, 11.7_

---

### 14. Final Checkpoint

- [ ] 14. Final checkpoint — Ensure all tests pass
  - Run `pytest backend/tests/ -v` (unit, property, integration)
  - Run frontend test suite
  - Run `npx playwright test` (E2E)
  - Confirm zero failures; ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP delivery.
- Property tests use [Hypothesis](https://hypothesis.readthedocs.io/) with a minimum of 100 iterations per property.
- Each property test references its design property number and the requirements it validates.
- Checkpoints (tasks 6, 12, 14) are integration gates — do not proceed past them with failing tests.
- The backend service layer must always scope queries to `current_user.id`; this is the primary cross-user isolation mechanism.
- Alembic migrations must be tested against a real PostgreSQL instance (use Docker locally or the Render test database).
- The frontend never stores the access token in `localStorage` or `sessionStorage`; it lives in memory only.
- Auth routes use the prefix `/api/auth` (not `/api/v1/auth`); all other API routes use `/api/v1`.
- Password hashing uses `werkzeug.security.generate_password_hash` / `check_password_hash` (PBKDF2-SHA256); raw refresh tokens are never stored — only their SHA-256 hash.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.4"] },
    { "id": 2, "tasks": ["1.5", "2.1"] },
    { "id": 3, "tasks": ["2.2", "2.3", "2.4", "3.1"] },
    { "id": 4, "tasks": ["3.2", "3.3"] },
    { "id": 5, "tasks": ["3.4", "3.5", "4.1", "5.1"] },
    { "id": 6, "tasks": ["3.6", "3.7", "4.2", "4.3", "5.2"] },
    { "id": 7, "tasks": ["4.4", "7.1"] },
    { "id": 8, "tasks": ["7.2"] },
    { "id": 9, "tasks": ["7.3", "8.1"] },
    { "id": 10, "tasks": ["8.2", "8.3", "9.1", "10.1"] },
    { "id": 11, "tasks": ["8.4", "9.2", "10.2", "11.1"] },
    { "id": 12, "tasks": ["10.3", "11.2"] },
    { "id": 13, "tasks": ["13.1"] },
    { "id": 14, "tasks": ["13.2", "13.3"] }
  ]
}
```
