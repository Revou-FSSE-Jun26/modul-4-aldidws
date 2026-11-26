# RevoTask — Task Management Application

> A full-stack Kanban-style task management platform built with **Next.js** and **Flask**,
> developed using the **Kiro AI IDE** as a demonstration of AI-assisted software engineering.

---

## Table of Contents

1. [Overview & Project Brief](#1-overview--project-brief)
2. [AI Workflow Summary](#2-ai-workflow-summary)
3. [Features Implemented](#3-features-implemented)
4. [Technologies Used](#4-technologies-used)
5. [How to Run Locally](#5-how-to-run-locally)
6. [How to Run the Test Suite](#6-how-to-run-the-test-suite)
7. [Screenshots](#7-screenshots)

---

## 1. Overview & Project Brief

**RevoTask** is a Trello-like, web-based task management application that lets
authenticated users organise their work through a Kanban board paradigm: boards contain
ordered columns, columns contain ordered cards, and cards support comments and
drag-and-drop reordering. The Flask API and PostgreSQL run on **Railway** and the
Next.js frontend on **Vercel** (see `docs/deployment-railway.md` and
`docs/deployment-vercel.md`). The Kanban UI described in section 3 is in the working tree
and **not committed or deployed yet**; until it is, the deployed site shows the older UI.

### User Roles

| Role       | Capabilities                                                                                                                                                           |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Guest**  | Register a new account; log in to an existing account.                                                                                                                 |
| **Member** | Create and use their own boards, columns and cards; drag and drop cards; add, edit and delete their own comments; see notifications; search cards; edit their profile. |

There is no board sharing: every board has exactly one owner. The `role` field on a user
exists but no feature depends on it.

Note: Board sharing, members, and roles are explicitly out of scope for the MVP. A board
has exactly one owner and no members. This is confirmed in `specs/requirements.md` section 2
("There is no board sharing. A board has exactly one owner and no members.") and in
`specs/design.md` section 1 ("Every resource belongs to one user through its board").

### Core Features

- **JWT Authentication** — registration and login. The access token is kept in memory only, so a page reload asks you to log in again.
- **Auth Pages** — login and register use a two-column layout with a brand panel (left) and form card (right). The brand panel shows the app logo, name, and tagline on desktop; it is hidden on mobile.
- **Kanban Boards** — create boards, add, rename and delete columns, add, edit, move and delete cards.
- **Drag-and-Drop** — native HTML5 drag with a Float `order`, optimistic update and rollback on error. On touch screens use "Move to column" in the card dialog.
- **Comments** — per-card comments with add, edit and delete by the author.
- **Notifications** — the board owner gets one notification per new comment; the header bell shows the unread count and refreshes every 30 seconds.
- **Inbox** — dedicated page (`/inbox`) listing notifications with read/unread states, mark-as-read action, and empty state.
- **Search** — debounced card search over title and description on the open board.
- **My Tasks** — every card you created, grouped by board.
- **Notes** — placeholder page (`/notes`) for a personal notes feature (not yet implemented).
- **Reports** — placeholder page (`/reports`) for a reports/analytics feature (not yet implemented).
- **User Profile** — update display name and IANA timezone.
- **Board Analytics** — backend endpoint only (no UI).

### Non-Functional Requirements

1. **Performance** — API responses target < 500 ms at the 95th percentile under MVP load.
   Card creation and updates must be reflected in the UI within 1 second.
2. **Security** — Passwords hashed with Werkzeug `generate_password_hash` (default
   method; see V-013 in the violation report). Access tokens expire after 15 minutes and
   are kept in browser memory only (no cookies, `localStorage` or `sessionStorage`).
   All protected endpoints enforce server-side ownership checks: other users' boards,
   columns and cards return 404, and editing someone else's comment returns 403. Secrets are stored in environment variables only.
3. **Maintainability** — Backend follows a strict routes → services → models layering.
   Frontend uses reusable shared components (`BaseButton`, `BaseModal`, `BaseBadge`) and
   custom hooks. ESLint and TypeScript checks enforce code quality on every change.
4. **Reliability** — Multi-record operations execute within a single database transaction.
   Optimistic UI updates roll back automatically when the backend returns an error.

---

## 2. AI Workflow Summary

RevoTask was built end-to-end inside the **Kiro AI IDE**, following this iterative workflow:

```
1. Project Brief
   └─ Wrote the initial product vision, user roles, and core feature list as a
      natural-language brief. Stored in /specs/requirements.md.

2. Spec Iteration (Kiro Spec Mode)
   └─ Used Kiro's Spec workflow to expand the brief into structured requirements,
      a system design document (/specs/design.md), and an implementation task list
      (/specs/tasks.md) with acceptance criteria for every feature.

3. Guideline Authoring
   └─ Created /guidelines/backend.md, /guidelines/frontend.md, and
      /guidelines/database.md to encode architectural decisions, naming conventions,
      and anti-patterns as enforceable rules for the AI coding agents.

4. Implementation (Kiro Autopilot)
   └─ Kicked off Kiro's wf-coder and wf-planner agents to implement each task.
      Agents read the guidelines at the start of every session and followed them
      when generating code (blueprint structure, thin routes, service layer, etc.).

5. Code Review & Violation Report
   └─ Ran Kiro's semantic_reviewer agent after each implementation batch.
      Identified violations (see docs/reports/guideline-violations.md), issued targeted repair
      prompts, and verified fixes with the reviewer in an implement → review loop.

6. Testing
   └─ Backend: pytest API, service and contract tests written alongside implementation.
      Frontend: Jest + React Testing Library, plus ESLint and TypeScript checks.
      E2E: Playwright with Page Objects (auth, boards, cards, Kanban journey, mobile),
      run against local servers. See section 6 for the commands and last results.

7. Build Verification
   └─ `npx next build` confirmed exit code 0 after resolving static prerendering
      conflicts introduced by experimental Next.js 16 config flags.

8. Kiro CLI
   └─ Used the Kiro CLI to scaffold, execute, and refine the three test layers
      (pytest, React Testing Library, Playwright) and to generate/iterate
      project documentation against the locally running application.
```

---

## 3. Features Implemented

Everything in this table works in the working tree and was checked by the tests in
section 6. The Kanban UI part is not committed or deployed yet.

| Feature                                                                                                                                          | UI  | Backend |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | --- | ------- |
| Register, login, logout (logout clears the in-memory token; there is no server logout)                                                           | ✅  | ✅      |
| Auth pages (login, register): two-column layout with brand panel and form card                                                                   | ✅  | n/a     |
| Header with Dashboard, My Tasks, Inbox, Notes, Reports, Profile, your name, notification bell, Log out, and a mobile menu                          | ✅  | n/a     |
| Protected pages redirect to `/login?next=<page>` and return there after login                                                                    | ✅  | n/a     |
| Create board, list boards (`/`)                                                                                                                  | ✅  | ✅      |
| Board page from one request (`GET /api/boards/{id}` returns columns and cards)                                                                   | ✅  | ✅      |
| Add, rename and delete columns (a column that still has cards cannot be deleted: 409)                                                            | ✅  | ✅      |
| Add, edit and delete cards (delete is a soft delete with `deleted_at`)                                                                           | ✅  | ✅      |
| Drag a card to another column or position (`PATCH /api/v1/cards/{id}/position`, Float `order`)                                                   | ✅  | ✅      |
| "Move to column" select in the card dialog (works without drag, also on touch screens)                                                           | ✅  | ✅      |
| Comments in the card dialog: add, edit and delete your own, author name shown                                                                    | ✅  | ✅      |
| Search cards on the board (`GET /api/v1/cards?search=&board_id=`), open a result in the dialog                                                   | ✅  | ✅      |
| Due date on a card (set and remove in the dialog; Overdue / Due soon badge on board and My Tasks)                                                | ✅  | ✅      |
| Board labels: create, rename, recolour, delete; attach to cards (`/api/boards/{id}/labels`, `PUT /api/v1/cards/{id}/labels`)                     | ✅  | ✅      |
| Board filter bar: keyword, labels (any of), due date; state in `?q=&labels=&due=`; press `f` to focus (client-side, drag is off while filtering) | ✅  | n/a     |
| Notification bell with unread count; clicking a notification marks it read                                                                       | ✅  | ✅      |
| Inbox (`/inbox`): notifications list with read/unread states, mark-as-read action, empty state                                                   | ✅  | ✅      |
| Notes (`/notes`): placeholder page for personal notes (not yet implemented)                                                                       | ✅  | n/a     |
| Reports (`/reports`): placeholder page for analytics/reports (not yet implemented)                                                               | ✅  | n/a     |
| My Tasks (`/my-tasks`): your cards grouped by board, with "Load more"                                                                            | ✅  | ✅      |
| Profile (`/profile`): edit name and timezone, email read-only                                                                                    | ✅  | ✅      |
| Shared components `BaseButton`, `BaseBadge`, `BaseModal` (focus trap, Escape, focus return)                                                      | ✅  | n/a     |
| Layout fits a 375 px wide screen (columns scroll sideways, no page overflow)                                                                     | ✅  | n/a     |
| `GET /api/health`                                                                                                                                | n/a | ✅      |
| Board analytics summary                                                                                                                          | ❌  | ✅      |
| Column reorder                                                                                                                                   | ❌  | ✅      |
| Board rename and delete                                                                                                                          | ❌  | ✅      |

### Known limits

- **Reload logs you out.** The token lives in memory only and the backend has no refresh
  endpoint (V-009). After a reload you go to `/login?next=...` and come back to the same page.
  Only the path is kept, so active board filters (`?q=`, `?labels=`, `?due=`) are lost on reload.
  A link that already contains the query, opened through `/login?next=...`, is applied.
- **The board owner is notified on every comment, including their own.** Boards have one
  owner, so there is nobody else to notify. The bell refreshes every 30 seconds, so a new
  count can take up to 30 seconds to appear.
- **No drag on touch screens.** HTML5 drag and drop does not fire on touch. Use
  "Move to column" in the card dialog instead.
- Comment edit and delete check the author but not board ownership (see
  `docs/api/README.md`, "Known gaps").

---

## 4. Technologies Used

### Frontend

| Technology                  | Purpose                                  |
| --------------------------- | ---------------------------------------- |
| **Next.js 16** (App Router) | React framework, SSR, file-based routing |
| **React 19**                | UI component model                       |
| **TypeScript**              | Static typing                            |
| **Tailwind CSS**            | Utility-first styling                    |
| **react-hot-toast**         | Toast notifications                      |
| **Playwright**              | End-to-end browser testing               |

### Backend

| Technology                  | Purpose                              |
| --------------------------- | ------------------------------------ |
| **Flask**                   | Python web framework                 |
| **SQLAlchemy 2**            | ORM and query builder                |
| **Flask-Migrate / Alembic** | Database schema versioning           |
| **Marshmallow**             | Request validation and serialisation |
| **Flask-JWT-Extended**      | JWT authentication (encode/decode)   |
| **python-dotenv**           | Environment variable loading         |
| **Gunicorn**                | Production WSGI server               |
| **Pytest**                  | Backend unit and API testing         |

### Database

| Technology     | Purpose                     |
| -------------- | --------------------------- |
| **PostgreSQL** | Primary relational database |

### Infrastructure & Tooling

| Technology   | Purpose                                        |
| ------------ | ---------------------------------------------- |
| **Railway**  | Backend API and PostgreSQL hosting             |
| **Vercel**   | Frontend hosting                               |
| **Kiro**     | AI IDE used throughout development             |
| **Kiro CLI** | Test scaffolding, execution, and doc iteration |

---

## 5. How to Run Locally

### Prerequisites

- Python 3.11+
- Node.js 20+
- PostgreSQL 15+ running locally
- Git

---

### Backend Setup

```bash
# 1. Clone the repository
git clone https://github.com/your-username/revotask.git
cd revotask

# 2. Create and activate a Python virtual environment
python -m venv venv

# Windows
.\venv\Scripts\activate
# macOS / Linux
source venv/bin/activate

# 3. Install backend dependencies (from the backend/ directory)
cd backend
pip install -r requirements.txt

# 4. Create the backend environment file
cp app/.env.example app/.env
# Edit app/.env and set DATABASE_URL, JWT_SECRET_KEY, etc.

# 5. Create the database
createdb revotask   # or use pgAdmin / psql

# 6. Apply all migrations
flask --app "app:create_app" db upgrade

# 7. Start the development server
flask --app "app:create_app" run --debug
# API available at http://localhost:5000
```

> All Flask commands above run from the `backend/` directory. The Swagger UI is served at
> `http://localhost:5000/apidocs` once the server is running.

---

### Frontend Setup

```bash
# From the repository root:
cd frontend

# 1. Install dependencies
npm install

# 2. Create the frontend environment file
cp .env.example .env.local
# Edit .env.local:
#   NEXT_PUBLIC_API_BASE_URL=http://localhost:5000
#   API_BASE_URL=http://localhost:5000

# 3. Start the development server
npm run dev
# App available at http://localhost:3000
```

---

## 6. How to Run the Test Suite

### Backend — Pytest

```bash
# From the backend/ directory (venv activated):
cd backend

# Create the test database first (if it does not exist):
createdb revotask_test

# Point the tests at it. Use your own local credentials; do not commit them.
# The fallback in tests/conftest.py has no password, so without this variable
# (or PGPASSWORD / a pgpass file) the connection fails.
export TEST_DATABASE_URL=postgresql://postgres:<your-password>@localhost:5432/revotask_test
# PowerShell: $env:TEST_DATABASE_URL = "postgresql://postgres:<your-password>@localhost:5432/revotask_test"
export APP_ENV=testing

# Run all tests with verbose output:
pytest -v

# Only the comment tests (201, 400 missing/blank body, 401, 403 on another user's comment):
pytest tests/test_comments.py -v

# Only the frontend/backend payload contract tests:
pytest tests/contract -v
```

> The tables are created and dropped by the test session and every test runs inside a
> rolled-back transaction, so the test database is left empty.

### Frontend — Jest + React Testing Library

```bash
# From the frontend/ directory:
cd frontend

npx jest              # unit, component and contract tests (same as npm test)
npx tsc --noEmit      # type check
npm run lint          # ESLint
NEXT_PUBLIC_API_BASE_URL=https://example.up.railway.app npm run build   # production build
```

### End-to-End — Playwright

The suite lives in `e2e/` (config `e2e/playwright.config.ts`, Page Objects in
`e2e/pages/`) and uses the `@playwright/test` package installed in `frontend/`. Each test
registers its own new user through the API and logs in through the UI, so no shared
test account is needed. It has a desktop Chromium project and a 375 px mobile project.

1. Use a separate local database for e2e (not the pytest database and never
   production), and migrate it: `flask --app "app:create_app" db upgrade` from `backend/`.
2. Start Flask from `backend/` with `APP_ENV=development`, `DATABASE_URL` pointing at that
   database, `SECRET_KEY` and `JWT_SECRET_KEY` set, and
   `CORS_ALLOWED_ORIGINS=http://localhost:3000`, on port 5000.
3. Build and start Next from `frontend/` with
   `NEXT_PUBLIC_API_BASE_URL=http://localhost:5000`: `npm run build` then `npm run start`.
   Use a production build: against `next dev` the first compile of each route is slow
   enough to make the redirect checks time out.
4. Run the suite from `frontend/`:

```bash
npx playwright install chromium     # first time only
npm run e2e                         # = npx playwright test -c ../e2e/playwright.config.ts
npm run e2e -- kanban-journey       # only the Kanban journey (file name filter)
npx playwright show-report ../e2e/playwright-report
```

`E2E_BASE_URL` and `E2E_API_URL` default to `http://localhost:3000` and
`http://localhost:5000`. `e2e/utils/env.ts` refuses any other host unless
`E2E_ALLOW_REMOTE=1` is set, so the suite cannot hit production by accident.

### Last results (local, in the working tree)

These are the results of the runs made during the Kanban UI work. Nothing here was run
against the public Railway or Vercel URLs.

| Command                                                               | Result                                      |
| --------------------------------------------------------------------- | ------------------------------------------- |
| `pytest -q` (from `backend/`, `APP_ENV=testing`, local test database) | 325 passed                                  |
| `npx jest` (from `frontend/`)                                         | 39 suites, 339 tests passed                 |
| `npx tsc --noEmit`, `npm run lint`, `npm run build`                   | no errors (lint reports 1 warning)          |
| `npm run e2e` against local Flask + `next start`                      | 26 passed (chromium and mobile), no retries |

`waitForTimeout` is not used anywhere in `e2e/` or `frontend/` source.

The GitHub Actions e2e workflow (`.github/workflows/playwright.yml`) was not updated for
the new config location and needs a running backend, so CI e2e is not verified.

---

## 7. Screenshots

> **No screenshots have been taken yet.** Every cell below is a placeholder. Add real
> images after the Kanban UI is committed and deployed; the assessment asks for Postman
> and Playwright evidence against the public URLs, which has not been produced.

### Postman — API Blueprint Coverage (8 Blueprints)

| Blueprint                          | Screenshot                 |
| ---------------------------------- | -------------------------- |
| `auth` — register, login, health   | _(screenshot placeholder)_ |
| `boards` — CRUD                    | _(screenshot placeholder)_ |
| `columns` — CRUD + reorder         | _(screenshot placeholder)_ |
| `cards` — CRUD + position move     | _(screenshot placeholder)_ |
| `comments` — CRUD                  | _(screenshot placeholder)_ |
| `notifications` — list + mark read | _(screenshot placeholder)_ |
| `analytics` — board summary        | _(screenshot placeholder)_ |
| `users` — GET /me, PATCH /me       | _(screenshot placeholder)_ |

---

### Application Pages

| Page                                                 | Screenshot                 |
| ---------------------------------------------------- | -------------------------- |
| `/register` — Registration form                      | _(screenshot placeholder)_ |
| `/login` — Login form                                | _(screenshot placeholder)_ |
| `/` — Dashboard (boards grid)                        | _(screenshot placeholder)_ |
| `/boards/[id]` — Board detail with columns and cards | _(screenshot placeholder)_ |
| `/my-tasks` — Cards you created, grouped by board    | _(screenshot placeholder)_ |
| `/inbox` — Notifications list                        | _(screenshot placeholder)_ |
| `/notes` — Personal notes (placeholder)              | _(screenshot placeholder)_ |
| `/reports` — Analytics/reports (placeholder)         | _(screenshot placeholder)_ |
| `/profile` — User profile settings                   | _(screenshot placeholder)_ |

---

### Key Interactions

| Interaction                                 | Screenshot                 |
| ------------------------------------------- | -------------------------- |
| Drag-and-drop card between columns          | _(screenshot placeholder)_ |
| Notification bell with unread badge         | _(screenshot placeholder)_ |
| `CardDetailModal` with comment thread       | _(screenshot placeholder)_ |
| Mobile view — responsive layout (375 × 812) | _(screenshot placeholder)_ |

---

### Test Reports

| Report                                                                 | Screenshot                 |
| ---------------------------------------------------------------------- | -------------------------- |
| `pytest -v` — 168 tests passed (local run)                             | _(screenshot placeholder)_ |
| Postman — all 8 Blueprints reachable (after deployment, public URL)    | _(screenshot placeholder)_ |
| Playwright HTML report — all tests passed (after deployment, live URL) | _(screenshot placeholder)_ |
| `next build` — exit code 0                                             | _(screenshot placeholder)_ |

---

## Contributing

See [docs/reports/guideline-violations.md](./docs/reports/guideline-violations.md) for a
record of AI-generated code defects and their corrections, and
[docs/api/README.md](./docs/api/README.md) for the new and changed API endpoints.

See [specs/CHANGELOG.md](./specs/CHANGELOG.md) for the full change history.

---

_Built with [Kiro](https://kiro.dev) — AI-powered software engineering._
