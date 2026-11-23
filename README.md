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
ordered columns, columns contain ordered cards (tasks), and cards support comments,
assignments, and drag-and-drop reordering. The Flask REST API is deployed on **Railway**
and the Next.js frontend on **Vercel**; both are reachable via their public URLs.

### User Roles

| Role             | Capabilities                                                                                                                                                    |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Guest**        | Register a new account; log in to an existing account.                                                                                                          |
| **Board Member** | Create and manage personal boards, columns, and cards; drag and drop cards between columns; add and edit comments; view notifications; search and filter cards. |
| **Board Admin**  | All Member capabilities plus the ability to manage board settings, invite members, and access board-level analytics.                                            |

### Core Features

- **JWT Authentication** — secure login, registration, silent token refresh, and logout.
- **Kanban Boards** — create, rename, and delete boards with ordered columns and cards.
- **Drag-and-Drop** — HTML5 DnD with optimistic updates and automatic rollback on API error.
- **Comments** — per-card comment threads with create, edit, and delete.
- **Notifications** — real-time bell indicator that polls every 30 seconds.
- **Search & Filter** — debounced card search (300 ms) with assignee, label, and date filters.
- **User Profile** — update display name and IANA timezone.
- **Board Analytics** — total active cards per column via a single aggregated SQL query.

### Non-Functional Requirements

1. **Performance** — API responses target < 500 ms at the 95th percentile under MVP load.
   Card creation and updates must be reflected in the UI within 1 second.
2. **Security** — Passwords hashed with PBKDF2-SHA256. JWTs carry a 15-minute access
   token TTL and a 7-day httpOnly refresh token. All protected endpoints enforce
   server-side ownership checks. Secrets stored in environment variables only.
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
      Identified violations (see VIOLATION_REPORT.md), issued targeted repair
      prompts, and verified fixes with the reviewer in an implement → review loop.

6. Testing
   └─ Backend: pytest fixtures and API tests written alongside implementation.
      Frontend: ESLint + TypeScript checks enforced on every file change.
      E2E: Playwright tests covering 4 auth scenarios and 8 Kanban journey steps.

7. Build Verification
   └─ `npx next build` confirmed exit code 0 after resolving static prerendering
      conflicts introduced by experimental Next.js 16 config flags.

8. Kiro CLI
   └─ Used the Kiro CLI to scaffold, execute, and refine the three test layers
      (pytest, React Testing Library, Playwright) and to generate/iterate
      project documentation against the deployed application.
```

---

## 3. Features Implemented

| Feature                                                                         | Status |
| ------------------------------------------------------------------------------- | ------ |
| JWT authentication (register, login, silent refresh, logout)                    | ✅     |
| Board CRUD                                                                      | ✅     |
| Column CRUD + reorder (`PATCH /api/boards/<id>/columns/reorder`)                | ✅     |
| Card CRUD + position move (`PATCH /api/cards/<id>/position`) with Float `order` | ✅     |
| Drag-and-drop (HTML5 DnD, optimistic update, rollback on error)                 | ✅     |
| Comments (create, list, edit, delete with ownership enforcement)                | ✅     |
| Notification polling every 30 seconds + unread badge                            | ✅     |
| Card search with 300 ms debounce                                                | ✅     |
| User profile (name + IANA timezone update)                                      | ✅     |
| Board analytics (active card count per column, N+1-free)                        | ✅     |
| `GET /api/health` endpoint                                                      | ✅     |
| Soft delete (`deleted_at`) on cards                                             | ✅     |
| `/register` page with client-side validation                                    | ✅     |
| Shared component library (`BaseButton`, `BaseModal`, `BaseBadge`)               | ✅     |
| Playwright E2E tests (4 auth + 8 Kanban steps, zero `waitForTimeout`)           | ✅     |
| Backend pytest suite (13 tests: auth, cards service, comments API)              | ✅     |

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
| **Railway**  | Backend API and PostgreSQL deployment          |
| **Vercel**   | Frontend deployment                            |
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

# Set the test database URL (or add to app/.env):
export TEST_DATABASE_URL=postgresql://postgres:password@localhost:5432/revotask_test

# Run all tests with verbose output:
pytest -v

# Run a specific test file:
pytest tests/test_comments.py -v

# Run with coverage report:
pytest --cov=app --cov-report=term-missing -v
```

### Frontend — React Testing Library (Component Tests)

```bash
# From the frontend/ directory:
cd frontend

# Run all component and unit tests:
npm test

# Run in watch mode during development:
npm test -- --watch
```

### End-to-End — Playwright

```bash
# From the e2e/ directory:
cd e2e

# Install Playwright browsers (first time only):
npx playwright install

# Install OS-level browser dependencies (Linux CI only):
npx playwright install --with-deps

# Run all E2E tests locally (headless) — requires backend + frontend running:
npx playwright test

# Run all E2E tests against the LIVE deployed Vercel URL:
BASE_URL=https://your-frontend.vercel.app npx playwright test

# Run with headed browser (for debugging):
npx playwright test --headed

# Run only the auth tests:
npx playwright test tests/auth.spec.ts

# Run only the Kanban journey:
npx playwright test tests/kanban-journey.spec.ts

# View the HTML test report after a run:
npx playwright show-report
```

> **Note:** For local E2E runs, both the backend (`flask run` from `backend/`) and the
> frontend (`npm run dev` from `frontend/`) must be running. Set `BASE_URL`,
> `TEST_USER_EMAIL`, and `TEST_USER_PASSWORD` in `e2e/.env` (or pass via the CLI) before
> running. To test against the live Vercel URL instead, set `BASE_URL` to the deployed
> frontend address.

---

## 7. Screenshots

> Screenshots below are placeholders. Replace each `<!-- -->` comment with the actual
> image once the application is deployed or running locally.

### Postman — API Blueprint Coverage (8 Blueprints)

| Blueprint                                 | Screenshot                 |
| ----------------------------------------- | -------------------------- |
| `auth` — register, login, refresh, logout | _(screenshot placeholder)_ |
| `boards` — CRUD                           | _(screenshot placeholder)_ |
| `columns` — CRUD + reorder                | _(screenshot placeholder)_ |
| `cards` — CRUD + position move            | _(screenshot placeholder)_ |
| `comments` — CRUD                         | _(screenshot placeholder)_ |
| `notifications` — list + mark read        | _(screenshot placeholder)_ |
| `analytics` — board summary               | _(screenshot placeholder)_ |
| `users` — GET /me, PATCH /me              | _(screenshot placeholder)_ |

---

### Application Pages

| Page                                                 | Screenshot                 |
| ---------------------------------------------------- | -------------------------- |
| `/register` — Registration form                      | _(screenshot placeholder)_ |
| `/login` — Login form                                | _(screenshot placeholder)_ |
| `/` — Dashboard (boards grid)                        | _(screenshot placeholder)_ |
| `/boards/[id]` — Board detail with columns and cards | _(screenshot placeholder)_ |
| `/my-tasks` — All cards assigned to the user         | _(screenshot placeholder)_ |
| `/profile` — User profile settings                   | _(screenshot placeholder)_ |

---

### Key Interactions

| Interaction                                 | Screenshot                 |
| ------------------------------------------- | -------------------------- |
| Drag-and-drop card between columns          | _(screenshot placeholder)_ |
| Notification bell with unread badge         | _(screenshot placeholder)_ |
| `CardDetailModal` with comment thread       | _(screenshot placeholder)_ |
| Mobile view — responsive layout (390 × 844) | _(screenshot placeholder)_ |

---

### Test Reports

| Report                                                                | Screenshot                 |
| --------------------------------------------------------------------- | -------------------------- |
| `pytest -v` — 13 tests passed                                         | _(screenshot placeholder)_ |
| Postman — all 8 Blueprints reachable on the public Railway URL        | _(screenshot placeholder)_ |
| Playwright HTML report — all tests passed against the live Vercel URL | _(screenshot placeholder)_ |
| `next build` — exit code 0                                            | _(screenshot placeholder)_ |

---

## Contributing

See [VIOLATION_REPORT.md](./VIOLATION_REPORT.md) for a record of AI-generated code
defects and their corrections.

See [specs/CHANGELOG.md](./specs/CHANGELOG.md) for the full change history.

---

_Built with [Kiro](https://kiro.dev) — AI-powered software engineering._
