# Repository Restructure Plan — RevoTask

**Goal:** Reshape the flat root-level repository into the target layout defined in
`.kiro/steering/structure.md` while preserving all working functionality, git history,
Python imports, Playwright configuration, and CI workflow references.

---

## Findings from codebase exploration

### Current state
```
modulAIdevelopment/           ← repo root
├── app/                      ← Flask package (blueprints, models, common infra)
│   ├── __init__.py           (create_app factory)
│   ├── config.py
│   ├── extensions.py
│   ├── error_handlers.py     ← imports from app.exceptions
│   ├── exceptions.py
│   ├── blueprints/           ← 8 feature blueprints
│   └── models/               ← 7 SQLAlchemy models
├── migrations/               ← Alembic/Flask-Migrate
├── tests/                    ← pytest (conftest.py + 3 test files)
├── frontend/                 ← Next.js app
│   ├── app/                  ← Next.js App Router pages
│   ├── playwright.config.ts  ← testDir: './tests'
│   └── tests/                ← Playwright spec files (3 files)
├── .github/workflows/playwright.yml
├── .gitignore
├── README.md
└── VIOLATION_REPORT.md
```

### Target state
```
modulAIdevelopment/
├── .github/workflows/        (keep; update playwright.yml)
├── .kiro/steering/           (keep untouched)
├── specs/                    NEW — copied from .kiro/specs/
│   ├── requirements.md
│   ├── design.md
│   ├── tasks.md
│   ├── CHANGELOG.md
│   └── playwright/
│       └── requirements.md
├── guidelines/               NEW — created from steering/*.md content
│   ├── frontend.md
│   ├── backend.md
│   └── database.md
├── frontend/                 (keep; no structural changes)
├── backend/                  NEW wrapper directory
│   ├── app/                  MOVED from root app/
│   ├── migrations/           MOVED from root migrations/
│   └── tests/                MOVED from root tests/
├── e2e/                      NEW
│   ├── tests/                MOVED from frontend/tests/
│   ├── pages/                NEW (empty placeholder)
│   ├── fixtures/             NEW (empty placeholder)
│   ├── utils/                NEW (empty placeholder)
│   └── playwright.config.ts  NEW (relocated + updated config)
├── docs/                     NEW
│   └── reports/
│       ├── guideline-violations.md  (copy of root VIOLATION_REPORT.md)
│       └── ai-output-comparison.md (new placeholder)
├── .env.example              NEW at root
├── .gitignore                (keep; already correct)
└── README.md                 (keep)
```

### Critical import analysis

**Files that import `from app.exceptions import ...`** (must update if exceptions.py moves):
- `app/error_handlers.py` — `from app.exceptions import AppException`
- `app/blueprints/analytics/service.py` — `from app.exceptions import BoardNotFoundException`
- `app/blueprints/auth/service.py` — `from app.exceptions import InvalidCredentialsError, ResourceConflictException`
- `app/blueprints/boards/service.py` — `from app.exceptions import BoardNotFoundException, ResourceConflictException`
- `app/blueprints/cards/service.py` — `from app.exceptions import CardNotFoundException, ColumnNotFoundException`
- `app/blueprints/columns/service.py` — `from app.exceptions import BoardNotFoundException, ColumnNotFoundException`
- `app/blueprints/comments/service.py` — `from app.exceptions import CardNotFoundException, CommentNotFoundException, UnauthorizedCommentAccessError`
- `app/blueprints/notifications/service.py` — `from app.exceptions import NotificationNotFoundException`
- `tests/test_auth_service.py` — `from app.exceptions import InvalidCredentialsError, ResourceConflictException`
- `tests/test_cards_service.py` — `from app.exceptions import CardNotFoundException, ColumnNotFoundException`

**Files that import `from app.error_handlers import ...`**:
- `app/__init__.py` — `from app.error_handlers import register_error_handlers`

**Key design decision on `app/common/`:**
The plan instruction requires moving `exceptions.py` and `error_handlers.py` into
`backend/app/common/`. This changes their import paths from `app.exceptions` →
`app.common.exceptions` and `app.error_handlers` → `app.common.error_handlers`.
Every file listed above must be updated.

**Python working-directory constraint:**
pytest and flask will run from `backend/` as the working directory. The `app/`
package name does NOT change — it stays `app`. All `from app.xxx import yyy`
imports continue to work because `backend/` will be on `sys.path`. Only the
imports of `exceptions` and `error_handlers` change because those files physically
move from `app/` into `app/common/`.

**Playwright config constraint:**
- Current: `frontend/playwright.config.ts` with `testDir: './tests'`
- After move: spec files will be at `e2e/tests/`; a new `e2e/playwright.config.ts`
  with `testDir: './tests'` replaces it.
- The `playwright.yml` CI workflow runs `npx playwright test` from the repo root with
  `npm ci` — it references no explicit directory. After the restructure it must `cd`
  into `e2e/` before running, or use `--config e2e/playwright.config.ts`. The
  `webServer` command in `playwright.config.ts` currently runs `npm run dev` which
  assumes the Next.js deps are on `PATH`; after moving the config to `e2e/`, the
  `webServer.command` must be `npm --prefix ../frontend run dev`.
- `storageState` path `playwright/.auth/user.json` and the `AUTH_FILE` path in
  `auth.setup.ts` must be updated to point to the new location
  (`e2e/playwright/.auth/user.json` from the config's perspective, `../playwright/.auth/user.json`
  from the spec file's `__dirname`).

**No requirements.txt / wsgi.py found at root:**
There is no `wsgi.py` or `requirements.txt` at the repo root. The `.env.example` files
already exist at `app/.env.example` and `frontend/.env.example`. The root `.env.example`
is a new file to create by merging both.

---

## Complete file move table

| Old path | New path | Method |
|---|---|---|
| `app/` (entire directory) | `backend/app/` | `git mv app backend/app` |
| `migrations/` (entire) | `backend/migrations/` | `git mv migrations backend/migrations` |
| `tests/` (entire) | `backend/tests/` | `git mv tests backend/tests` |
| `frontend/tests/auth.setup.ts` | `e2e/tests/auth.setup.ts` | `git mv` |
| `frontend/tests/auth.spec.ts` | `e2e/tests/auth.spec.ts` | `git mv` |
| `frontend/tests/kanban-journey.spec.ts` | `e2e/tests/kanban-journey.spec.ts` | `git mv` |
| `frontend/playwright.config.ts` | `e2e/playwright.config.ts` | `git mv` |
| *(source: frontend/playwright/.auth/)* | `e2e/playwright/.auth/` | `git mv` (runtime artifact — may not be tracked) |

**Copied (not moved — originals preserved):**

| Source | Destination | Method |
|---|---|---|
| `.kiro/specs/task-management-app/requirements.md` | `specs/requirements.md` | `Copy-Item` |
| `.kiro/specs/task-management-app/design.md` | `specs/design.md` | `Copy-Item` |
| `.kiro/specs/task-management-app/tasks.md` | `specs/tasks.md` | `Copy-Item` |
| `.kiro/specs/CHANGELOG.md` | `specs/CHANGELOG.md` | `Copy-Item` |
| `.kiro/specs/playwright/requirements.md` | `specs/playwright/requirements.md` | `Copy-Item` |
| `VIOLATION_REPORT.md` | `docs/reports/guideline-violations.md` | `Copy-Item` |

**New files to create:**

| Path | Content description |
|---|---|
| `backend/app/common/__init__.py` | Empty init |
| `backend/app/common/exceptions.py` | Moved content from `app/exceptions.py` |
| `backend/app/common/error_handlers.py` | Moved content from `app/error_handlers.py` with updated import |
| `e2e/playwright.config.ts` | Moved + updated: `testDir: './tests'`, `webServer.command: 'npm --prefix ../frontend run dev'`, `storageState: 'playwright/.auth/user.json'` |
| `e2e/pages/.gitkeep` | Empty placeholder |
| `e2e/fixtures/.gitkeep` | Empty placeholder |
| `e2e/utils/.gitkeep` | Empty placeholder |
| `docs/reports/ai-output-comparison.md` | Placeholder with structure headings |
| `.env.example` | Merged backend + frontend variables |
| `guidelines/frontend.md` | 5+ rules from `.kiro/steering/frontend.md` in three-part format |
| `guidelines/backend.md` | 5+ rules from `.kiro/steering/backend.md` in three-part format |
| `guidelines/database.md` | 5+ rules from `.kiro/steering/database.md` in three-part format |

---

## Imports that must be updated

After `exceptions.py` and `error_handlers.py` move to `backend/app/common/`, update:

### `backend/app/__init__.py`
```python
# OLD:
from app.error_handlers import register_error_handlers
# NEW:
from app.common.error_handlers import register_error_handlers
```

### `backend/app/common/error_handlers.py` (the file itself)
```python
# OLD:
from app.exceptions import AppException
# NEW:
from app.common.exceptions import AppException
```

### All 8 blueprint `service.py` files
| File | Old import | New import |
|---|---|---|
| `analytics/service.py` | `from app.exceptions import BoardNotFoundException` | `from app.common.exceptions import BoardNotFoundException` |
| `auth/service.py` | `from app.exceptions import InvalidCredentialsError, ResourceConflictException` | `from app.common.exceptions import InvalidCredentialsError, ResourceConflictException` |
| `boards/service.py` | `from app.exceptions import BoardNotFoundException, ResourceConflictException` | `from app.common.exceptions import BoardNotFoundException, ResourceConflictException` |
| `cards/service.py` | `from app.exceptions import CardNotFoundException, ColumnNotFoundException` | `from app.common.exceptions import CardNotFoundException, ColumnNotFoundException` |
| `columns/service.py` | `from app.exceptions import BoardNotFoundException, ColumnNotFoundException` | `from app.common.exceptions import BoardNotFoundException, ColumnNotFoundException` |
| `comments/service.py` | `from app.exceptions import CardNotFoundException, CommentNotFoundException, UnauthorizedCommentAccessError` | `from app.common.exceptions import CardNotFoundException, CommentNotFoundException, UnauthorizedCommentAccessError` |
| `notifications/service.py` | `from app.exceptions import NotificationNotFoundException` | `from app.common.exceptions import NotificationNotFoundException` |
| `users/service.py` | (no exceptions import — no change needed) | — |

### `backend/tests/test_auth_service.py`
```python
# OLD:
from app.exceptions import InvalidCredentialsError, ResourceConflictException
# NEW:
from app.common.exceptions import InvalidCredentialsError, ResourceConflictException
```

### `backend/tests/test_cards_service.py`
```python
# OLD:
from app.exceptions import CardNotFoundException, ColumnNotFoundException
# NEW:
from app.common.exceptions import CardNotFoundException, ColumnNotFoundException
```

### `e2e/tests/auth.setup.ts`
```typescript
// OLD:
const AUTH_FILE = path.join(__dirname, "../playwright/.auth/user.json");
// NEW (file is now at e2e/tests/auth.setup.ts, auth dir at e2e/playwright/.auth/):
const AUTH_FILE = path.join(__dirname, "../playwright/.auth/user.json");
// (path remains the same relative to __dirname — no change needed as long as
//  e2e/playwright/.auth/ exists at the same relative depth)
```

### `e2e/playwright.config.ts`
```typescript
// webServer command must reference frontend from e2e/ directory:
webServer: {
  command: "npm --prefix ../frontend run dev",
  url: "http://localhost:3000",
  reuseExistingServer: !process.env.CI,
  timeout: 120_000,
},
// storageState path must remain relative to this config file:
storageState: "playwright/.auth/user.json",
// dotenv path:
dotenv.config({ path: "../frontend/.env.test" });
```

### `.github/workflows/playwright.yml`
```yaml
# OLD (runs from root, assumes playwright.config.ts at root):
- name: Install dependencies
  run: npm ci               # ← installs frontend/node_modules from wrong dir
- name: Run Playwright tests
  run: npx playwright test  # ← no config found at root

# NEW:
- name: Install frontend dependencies
  run: npm ci
  working-directory: frontend
- name: Install Playwright Browsers
  run: npx playwright install --with-deps
  working-directory: e2e      # playwright is a devDep in frontend but we run from e2e
- name: Run Playwright tests
  run: npx playwright test --config playwright.config.ts
  working-directory: e2e
- uses: actions/upload-artifact@v4
  if: ${{ !cancelled() }}
  with:
    name: playwright-report
    path: e2e/playwright-report/   # ← updated artifact path
    retention-days: 30
```

> **Note on Playwright devDependency location:** `playwright` is currently installed
> as a devDependency in `frontend/package.json`. After the restructure, the simplest
> approach is to reference it from `frontend/node_modules/.bin` by using
> `../frontend/node_modules/.bin/playwright test` or by adding a minimal `package.json`
> in `e2e/` that lists `@playwright/test` as a devDependency and running `npm ci`
> there. The plan uses option A (run with `npx` after `npm ci` in `frontend/`) — see
> Step 10 for the exact workflow YAML.

---

## Exact sequence of steps

### Step 1 — Create the `backend/` wrapper and move Flask app

**What:** Create `backend/` directory and use `git mv` to move `app/`, `migrations/`,
and `tests/` into it. This preserves all git history for every Python file.

**Files changed:**
- `app/` → `backend/app/`
- `migrations/` → `backend/migrations/`
- `tests/` → `backend/tests/`

**Commands:**
```powershell
cd c:\Users\aldid\modulAIdevelopment
git mv app backend/app
git mv migrations backend/migrations
git mv tests backend/tests
```

> Git will create `backend/` automatically on the first `git mv`.

**Verify:**
```powershell
Get-ChildItem backend | Select-Object Name
# Expected: app  migrations  tests
```

---

### Step 2 — Create `backend/app/common/` and move shared infrastructure files

**What:** Create `backend/app/common/` and move `exceptions.py` and `error_handlers.py`
into it. These files need to live under `common/` per the target structure. Because
`git mv` already moved them to `backend/app/`, use a second `git mv` to relocate them
within the new tree.

**Commands:**
```powershell
New-Item -ItemType Directory -Force -Path "backend/app/common"
# Create empty __init__.py for the common package
New-Item -ItemType File -Path "backend/app/common/__init__.py"
git mv backend/app/exceptions.py backend/app/common/exceptions.py
git mv backend/app/error_handlers.py backend/app/common/error_handlers.py
git add backend/app/common/__init__.py
```

**Verify:**
```powershell
Test-Path backend/app/common/exceptions.py     # → True
Test-Path backend/app/common/error_handlers.py # → True
Test-Path backend/app/common/__init__.py       # → True
```

---

### Step 3 — Update all Python imports for the relocated common files

**What:** Update every `from app.exceptions import ...` → `from app.common.exceptions import ...`
and `from app.error_handlers import ...` → `from app.common.error_handlers import ...`.
This is the highest-risk step; every import must be correct before any test can run.

**Files to edit:**

1. `backend/app/__init__.py`
   - Line: `from app.error_handlers import register_error_handlers`
   - Change to: `from app.common.error_handlers import register_error_handlers`

2. `backend/app/common/error_handlers.py`
   - Line: `from app.exceptions import AppException`
   - Change to: `from app.common.exceptions import AppException`

3. `backend/app/blueprints/analytics/service.py`
   - `from app.exceptions import BoardNotFoundException`
   - → `from app.common.exceptions import BoardNotFoundException`

4. `backend/app/blueprints/auth/service.py`
   - `from app.exceptions import InvalidCredentialsError, ResourceConflictException`
   - → `from app.common.exceptions import InvalidCredentialsError, ResourceConflictException`

5. `backend/app/blueprints/boards/service.py`
   - `from app.exceptions import BoardNotFoundException, ResourceConflictException`
   - → `from app.common.exceptions import BoardNotFoundException, ResourceConflictException`

6. `backend/app/blueprints/cards/service.py`
   - `from app.exceptions import CardNotFoundException, ColumnNotFoundException`
   - → `from app.common.exceptions import CardNotFoundException, ColumnNotFoundException`

7. `backend/app/blueprints/columns/service.py`
   - `from app.exceptions import BoardNotFoundException, ColumnNotFoundException`
   - → `from app.common.exceptions import BoardNotFoundException, ColumnNotFoundException`

8. `backend/app/blueprints/comments/service.py`
   - `from app.exceptions import CardNotFoundException, CommentNotFoundException, UnauthorizedCommentAccessError`
   - → `from app.common.exceptions import CardNotFoundException, CommentNotFoundException, UnauthorizedCommentAccessError`

9. `backend/app/blueprints/notifications/service.py`
   - `from app.exceptions import NotificationNotFoundException`
   - → `from app.common.exceptions import NotificationNotFoundException`

10. `backend/tests/test_auth_service.py`
    - `from app.exceptions import InvalidCredentialsError, ResourceConflictException`
    - → `from app.common.exceptions import InvalidCredentialsError, ResourceConflictException`

11. `backend/tests/test_cards_service.py`
    - `from app.exceptions import CardNotFoundException, ColumnNotFoundException`
    - → `from app.common.exceptions import CardNotFoundException, ColumnNotFoundException`

**Verify:** Run Python import check from `backend/`:
```powershell
cd c:\Users\aldid\modulAIdevelopment\backend
python -c "from app import create_app; print('import OK')"
# Expected: "import OK"
```

---

### Step 4 — Move Playwright tests to `e2e/`

**What:** Create the `e2e/` directory structure and use `git mv` to move the three spec
files and the config from `frontend/tests/` and `frontend/playwright.config.ts`.

**Commands:**
```powershell
cd c:\Users\aldid\modulAIdevelopment
New-Item -ItemType Directory -Force -Path "e2e/tests"
New-Item -ItemType Directory -Force -Path "e2e/pages"
New-Item -ItemType Directory -Force -Path "e2e/fixtures"
New-Item -ItemType Directory -Force -Path "e2e/utils"
New-Item -ItemType Directory -Force -Path "e2e/playwright/.auth"

git mv frontend/tests/auth.setup.ts e2e/tests/auth.setup.ts
git mv frontend/tests/auth.spec.ts e2e/tests/auth.spec.ts
git mv frontend/tests/kanban-journey.spec.ts e2e/tests/kanban-journey.spec.ts
git mv frontend/playwright.config.ts e2e/playwright.config.ts
```

After moving, `frontend/tests/` will be empty. Remove it:
```powershell
git rm -r frontend/tests
```

If `frontend/playwright/.auth/` contains tracked files:
```powershell
git mv frontend/playwright e2e/playwright
```
If it contains only untracked/ignored files, copy them manually:
```powershell
Copy-Item -Recurse frontend/playwright/.auth e2e/playwright/.auth -ErrorAction SilentlyContinue
```

**Verify:**
```powershell
Get-ChildItem e2e/tests | Select-Object Name
# Expected: auth.setup.ts  auth.spec.ts  kanban-journey.spec.ts
Test-Path e2e/playwright.config.ts  # → True
```

---

### Step 5 — Update `e2e/playwright.config.ts`

**What:** The config moved from `frontend/` to `e2e/`, so relative paths and the
`webServer.command` must be updated. `testDir` stays `'./tests'` — it was already
pointing there and the files are now there.

**Full updated `e2e/playwright.config.ts`:**
```typescript
import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
dotenv.config({ path: "../frontend/.env.test" });

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "setup",
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      dependencies: ["setup"],
    },
  ],
  webServer: {
    command: "npm --prefix ../frontend run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

**Files changed:** `e2e/playwright.config.ts`

**Verify:** No build step needed; TypeScript will be validated in Step 11.

---

### Step 6 — Update `.github/workflows/playwright.yml`

**What:** The CI workflow currently runs `npm ci` and `npx playwright test` from the
repo root. After the restructure, Playwright lives in `e2e/` with its config there,
but `@playwright/test` is a devDependency of `frontend/package.json`.

**Strategy:** Install frontend deps (which includes `@playwright/test`), then run
Playwright using the `e2e/playwright.config.ts` config, working from the repo root to
keep the `npm --prefix ../frontend` reference in `webServer` working correctly.

**Updated `.github/workflows/playwright.yml`:**
```yaml
name: Playwright Tests
on:
  push:
    branches: [ main, master ]
  pull_request:
    branches: [ main, master ]
jobs:
  test:
    timeout-minutes: 60
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: lts/*
    - name: Install frontend dependencies
      run: npm ci
      working-directory: frontend
    - name: Install Playwright Browsers
      run: npx playwright install --with-deps
      working-directory: frontend
    - name: Run Playwright tests
      run: npx playwright test --config e2e/playwright.config.ts
    - uses: actions/upload-artifact@v4
      if: ${{ !cancelled() }}
      with:
        name: playwright-report
        path: e2e/playwright-report/
        retention-days: 30
```

**Files changed:** `.github/workflows/playwright.yml`

---

### Step 7 — Copy specs to `specs/` (originals preserved)

**What:** Use `Copy-Item` to copy spec documents from `.kiro/specs/` into the new
`specs/` directory. Do NOT delete originals — Kiro reads them from `.kiro/specs/`.

**Commands:**
```powershell
cd c:\Users\aldid\modulAIdevelopment
New-Item -ItemType Directory -Force -Path "specs/playwright"

Copy-Item ".kiro/specs/task-management-app/requirements.md" "specs/requirements.md"
Copy-Item ".kiro/specs/task-management-app/design.md"       "specs/design.md"
Copy-Item ".kiro/specs/task-management-app/tasks.md"        "specs/tasks.md"
Copy-Item ".kiro/specs/CHANGELOG.md"                        "specs/CHANGELOG.md"
Copy-Item ".kiro/specs/playwright/requirements.md"          "specs/playwright/requirements.md"
```

**Verify:**
```powershell
Get-ChildItem specs | Select-Object Name
# Expected: requirements.md  design.md  tasks.md  CHANGELOG.md  playwright/
```

---

### Step 8 — Create `docs/` with reports

**What:** Create `docs/reports/` and populate it with the violation report (copied from
root `VIOLATION_REPORT.md`) and a placeholder AI output comparison document.

**Commands:**
```powershell
New-Item -ItemType Directory -Force -Path "docs/reports"
New-Item -ItemType Directory -Force -Path "docs/adr"
Copy-Item "VIOLATION_REPORT.md" "docs/reports/guideline-violations.md"
```

Create `docs/adr/README.md`:
```markdown
# Architecture Decision Records

ADRs are stored in this directory.

Format: `NNNN-short-title.md`

| ID | Title | Status |
|---|---|---|
| (none yet) | | |
```

Create `docs/reports/ai-output-comparison.md`:
```markdown
# AI Output Comparison — RevoTask

This document records measurable AI output quality differences observed
before and after applying the engineering guidelines in `/guidelines/`.

## Comparison 1 — (title)

**Guideline applied:** `guidelines/backend.md` §X

**Before:** (AI-generated output without guideline)

**After:** (AI-generated output with guideline)

**Observable difference:**
```

---

### Step 9 — Create root `.env.example`

**What:** Merge content from `app/.env.example` and `frontend/.env.example` into a
single root `.env.example`. The existing per-directory files remain where they are.

**Content of root `.env.example`:**
```env
# =============================================================
# RevoTask — Root Environment Variables
# Copy relevant sections to backend/.env and frontend/.env.local
# NEVER commit files without the .example suffix.
# =============================================================

# ---- Backend (Flask) ----------------------------------------
FLASK_APP=wsgi:app
FLASK_ENV=development
SECRET_KEY=change-me-to-a-random-32-byte-hex-string
JWT_SECRET_KEY=change-me-to-a-different-random-secret
DATABASE_URL=postgresql://postgres:password@localhost:5432/revotask
TEST_DATABASE_URL=postgresql://postgres:password@localhost:5432/revotask_test
JWT_ACCESS_TOKEN_EXPIRES_MINUTES=15
JWT_REFRESH_TOKEN_EXPIRES_DAYS=7
CORS_ALLOWED_ORIGINS=http://localhost:3000

# ---- Frontend (Next.js) -------------------------------------
NEXT_PUBLIC_API_BASE_URL=http://localhost:5000
API_BASE_URL=http://localhost:5000

# ---- E2E / Playwright ---------------------------------------
BASE_URL=http://localhost:3000
TEST_USER_EMAIL=e2e-test@example.com
TEST_USER_PASSWORD=TestPass1!
```

**Files changed / created:** `.env.example` (new at root)

---

### Step 10 — Create `guidelines/` files

**What:** Create three guideline files in the three-part format (`## Title / ### Rule /
### Rationale / ### RevoTask Example`) with at least 5 rules each, extracted and
reformatted from the steering files.

#### `guidelines/frontend.md` — 5 rules

**Rule 1: Use Client Components only when browser APIs are required**
```markdown
## Use Client Components Only for Interactivity

### Rule
A component MUST use `"use client"` only when it requires React state, browser APIs,
event handlers, or client-side context consumption. Server Components MUST be the default.

### Rationale
Server Components reduce JavaScript bundle size, enable server-side data fetching,
and keep secrets out of the browser. Converting entire pages to Client Components
for one interactive element wastes these benefits.

### RevoTask Example
`frontend/app/page.tsx` (the dashboard) is a Server Component that fetches the board
list on the server. Only `BoardsGrid.tsx`, which handles drag interactions, carries
`"use client"`.
```

**Rule 2: Place API communication in service modules, not components**
```markdown
## Centralize API Calls in Service Modules

### Rule
HTTP calls MUST live in feature service modules under `features/<name>/services/`.
Presentation components MUST NOT contain raw `fetch` calls or Axios configuration.

### Rationale
Scattering fetch calls across components duplicates URL construction and error handling,
makes testing harder, and couples UI rendering to transport details.

### RevoTask Example
`frontend/lib/apiClient.ts` contains the base Axios instance. Feature services such as
`features/boards/services/boardService.ts` call `apiClient.get('/api/boards')` and
return typed domain objects. No board-related component calls `fetch` directly.
```

**Rule 3: Use `Base`-prefixed shared primitives for reusable UI elements**
```markdown
## Use BaseButton and Other Base Primitives for Shared UI

### Rule
Reusable UI primitives MUST live in `components/shared/` with a `Base` prefix
(e.g. `BaseButton`, `BaseModal`, `BaseInput`). Feature pages MUST use these
components rather than duplicating Tailwind class strings.

### Rationale
Duplicated Tailwind class strings across pages diverge over time, making visual
consistency impossible to maintain. Centralizing styling in `BaseButton` means
a single change propagates everywhere.

### RevoTask Example
`frontend/app/login/page.tsx` and `frontend/app/register/page.tsx` both use
`<BaseButton variant="primary">`. The 7-line raw `<button>` with duplicated
Tailwind classes (Violation 3 in VIOLATION_REPORT.md) was replaced in both files.
```

**Rule 4: Never write `ref.current` during the render phase**
```markdown
## Assign ref.current Only Inside Effects or Event Handlers

### Rule
`ref.current` MUST NOT be written at the top level of a component or hook during
rendering. Assignments MUST be wrapped inside `useEffect` with appropriate dependencies.

### Rationale
Writing refs during render is undefined behaviour under React's concurrent rendering
model. It was flagged by `eslint-plugin-react-hooks` in `eslint.config.mjs` and
causes non-deterministic behaviour on repeated renders.

### RevoTask Example
`frontend/hooks/useCardSearch.ts` previously wrote `filtersRef.current = filters`
at the hook's top level. The fix moved it into `useEffect(() => { filtersRef.current = filters; }, [filters.query, ...])`.
```

**Rule 5: Type all API contracts with explicit TypeScript interfaces**
```markdown
## Define Explicit TypeScript Interfaces for API Contracts

### Rule
Every API response shape consumed by the frontend MUST have an explicit TypeScript
`interface` or `type`. Using `any` for API responses is prohibited.

### Rationale
Untyped API responses cause runtime errors to appear as TypeScript compilation
successes and make refactoring across the API boundary impossible to verify statically.

### RevoTask Example
`frontend/features/boards/types/index.ts` defines `Board`, `BoardColumn`, and `Card`
interfaces that mirror the backend's response schemas. `boardService.ts` returns
`Promise<Board[]>` — TypeScript enforces the contract at the call site.
```

#### `guidelines/backend.md` — 5 rules

**Rule 1: Routes must be thin — delegate to service layer**
```markdown
## Route Handlers Must Delegate to the Service Layer

### Rule
Route handlers MUST only: read request data, validate it via a Marshmallow schema,
call the appropriate service function, and return the serialized result.
Business logic, database queries, and authorization checks MUST live in `service.py`.

### Rationale
Thin handlers make services independently testable with ordinary Python calls.
Fat handlers tightly couple HTTP semantics to business rules, making unit testing
impossible without spinning up Flask.

### RevoTask Example
`app/blueprints/comments/routes.py` after the Violation 1 fix:
```python
@comments_bp.route("/<card_id>/comments", methods=["POST"])
@token_required
def create_comment(current_user, card_id):
    data = CreateCommentSchema().load(request.get_json() or {})
    comment = service.create_comment(current_user, uuid.UUID(card_id), data)
    return jsonify({"data": comment_to_dict(comment)}), 201
```
```

**Rule 2: Use typed AppException subclasses for all expected failures**
```markdown
## Raise Typed AppException Subclasses, Never Ad-Hoc Error Responses

### Rule
Every expected application failure MUST raise a typed subclass of `AppException`
defined in `app/common/exceptions.py`. Route handlers MUST NOT build inline
`jsonify({"error": ...})` responses for expected business failures.

### Rationale
Centralizing error formatting in the global handler guarantees consistent response
envelopes and HTTP status codes. Inline error construction in routes creates
divergent formats that break frontend error handling.

### RevoTask Example
`app/common/exceptions.py` defines `CardNotFoundException(AppException)` with
`status_code=404` and `error_code="CARD_NOT_FOUND"`. Services raise it;
`app/common/error_handlers.py` formats it. No route constructs a 404 manually.
```

**Rule 3: Use the standard response envelope `{"data": ...}` / `{"error": ...}`**
```markdown
## All API Responses Must Use the Standard Envelope

### Rule
Successful responses MUST use `{"data": <payload>}` (single resource) or
`{"data": [...], "meta": {...}}` (collection). Error responses MUST use
`{"error": {"code": "...", "message": "...", "details": ...}}`.
No endpoint MAY deviate from this contract.

### Rationale
A consistent envelope allows the frontend's `apiClient.ts` to handle errors
uniformly and prevents subtle bugs caused by some endpoints returning bare objects
while others wrap them.

### RevoTask Example
`app/blueprints/boards/routes.py` returns `jsonify({"data": board_to_dict(board)}), 201`
for board creation and relies on the global `AppException` handler for errors — the
frontend's `lib/errors.ts` reads `response.data.error.code` in one place for all routes.
```

**Rule 4: Never commit secrets — load from environment variables**
```markdown
## Load All Secrets From Environment Variables

### Rule
JWT signing secrets, database URLs, and API keys MUST be loaded from environment
variables via `app/config.py`. They MUST NOT be hardcoded in any Python file.
`.env` files MUST be gitignored; only `.env.example` with placeholder values is committed.

### Rationale
Committed secrets cannot be rotated without rewriting git history and may be
exposed in public repositories or CI logs. Environment-variable injection is the
standard twelve-factor approach supported by all deployment platforms.

### RevoTask Example
`app/config.py` reads `JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY")` and raises
at startup if the value is missing in production. `backend/.env.example` documents
the variable with a placeholder value; the real `.env` is gitignored.
```

**Rule 5: Validate every incoming request body with a Marshmallow schema**
```markdown
## Validate All Incoming Data Through Marshmallow Schemas

### Rule
Every endpoint that accepts a request body MUST validate it through a named
Marshmallow schema defined in the blueprint's `schema.py`. Direct access to
`request.json` without schema validation is prohibited.

### Rationale
Schema-less validation relies on scattered `if "field" not in data` checks that
are inconsistent, miss type coercion, and produce non-uniform error messages.
Marshmallow raises `ValidationError` which the global handler formats identically
across all endpoints.

### RevoTask Example
`app/blueprints/cards/schema.py` defines `CreateCardSchema` with explicit field
types, `required=True`, and `validate.Length` constraints. The route calls
`CreateCardSchema().load(request.get_json())` before invoking the service, so
invalid data never reaches business logic.
```

#### `guidelines/database.md` — 5 rules

**Rule 1: Use UUID primary keys for all core domain entities**
```markdown
## Use UUID Primary Keys for Core Domain Entities

### Rule
Every core domain entity table (users, boards, board_columns, cards, comments,
notifications) MUST use a UUID primary key generated by `uuid.uuid4`.
Integer auto-increment IDs MUST NOT be mixed with UUID IDs in the same relationship.

### Rationale
UUIDs prevent ID enumeration attacks, allow application-layer ID generation before
database insertion, and avoid revealing entity counts to clients.

### RevoTask Example
`app/models/card.py` defines `id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)`.
Foreign keys in `card_comments` use `Uuid(as_uuid=True)` to match.
```

**Rule 2: Use `Float` for card and column ordering columns**
```markdown
## Use Float Ordering (Midpoint Insertion Strategy) for Cards and Columns

### Rule
The `order` column on `cards` and `position` column on `board_columns` MUST use
`db.Float`. Integer ordering that requires renumbering on every insertion is prohibited.
A check constraint MUST enforce `order >= 0`.

### Rationale
Float ordering allows inserting a card between positions 1.0 and 2.0 by assigning
1.5, with no updates to other rows. Integer ordering requires an O(n) shift on every
insertion, which causes lock contention on busy boards.

### RevoTask Example
```python
# app/models/card.py
order: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
__table_args__ = (
    CheckConstraint('"order" >= 0', name="ck_cards_order_nonnegative"),
    Index("ix_cards_column_id_order", "column_id", "order"),
)
```
The migration in `migrations/versions/e75e73442f21_*.py` renamed `position → order`
and changed the column type.
```

**Rule 3: Store timestamps in UTC with timezone-aware columns**
```markdown
## Store All Timestamps in UTC Using Timezone-Aware Columns

### Rule
All timestamp columns MUST use `DateTime(timezone=True)`. `datetime.utcnow()` is
prohibited; use `datetime.now(timezone.utc)` or a `server_default=func.now()`.
Naive datetime objects MUST NOT be stored in timestamp columns.

### Rationale
Naive datetimes cannot be reliably converted to local time zones at query time and
produce incorrect behaviour when application servers run in different time zones.
PostgreSQL stores timezone-aware timestamps as UTC internally.

### RevoTask Example
`app/models/card.py` defines:
```python
created_at: Mapped[datetime] = mapped_column(
    DateTime(timezone=True), nullable=False, server_default=func.now()
)
updated_at: Mapped[datetime] = mapped_column(
    DateTime(timezone=True), nullable=False,
    server_default=func.now(), onupdate=func.now()
)
```
```

**Rule 4: Every schema change must include a reviewed Alembic migration**
```markdown
## Every Schema Change Requires a Reviewed Alembic Migration

### Rule
No schema change (column addition, type change, constraint addition, table creation)
MAY be deployed using `db.create_all()` or by editing an existing migration.
Every change MUST generate a new migration file via `flask db migrate` and be reviewed
before `flask db upgrade` runs.

### Rationale
`create_all()` is non-idempotent and silently skips existing tables. Editing applied
migrations corrupts the migration history and prevents reproducible database states
across environments.

### RevoTask Example
The `position → order` float change is tracked in
`migrations/versions/e75e73442f21_add_order_float_deleted_at_.py`.
The migration includes both upgrade (rename + type change) and a downgrade function.
```

**Rule 5: Enforce foreign-key relationships with explicit constraints and compatible types**
```markdown
## Enforce Foreign Keys With Explicit Constraints and Compatible Column Types

### Rule
Every parent-child relationship MUST have a database-level `ForeignKey` constraint.
The child column type MUST be compatible with the parent's primary key type (UUID → UUID,
Integer → Integer). `ondelete` behavior MUST be chosen explicitly — not left as the
PostgreSQL default (`NO ACTION`).

### Rationale
Orphaned records accumulate silently without foreign-key constraints. Type mismatches
between primary and foreign keys cause PostgreSQL to reject inserts with cryptic errors.
Implicit `NO ACTION` on delete makes cascade behavior invisible to code reviewers.

### RevoTask Example
`app/models/card_comment.py`:
```python
card_id: Mapped[uuid.UUID] = mapped_column(
    Uuid(as_uuid=True),
    ForeignKey("cards.id", ondelete="CASCADE"),
    nullable=False,
    index=True,
)
```
```

**Files created:**
- `guidelines/frontend.md`
- `guidelines/backend.md`
- `guidelines/database.md`

**Verify:** Files exist and contain the three-part structure:
```powershell
Select-String -Path "guidelines/*.md" -Pattern "^### Rule"
# Should return at least 5 matches per file
```

---

### Step 11 — Verify Python imports compile cleanly

**What:** Activate the venv and run a quick import test from `backend/` to confirm
all `app.common.*` imports resolve correctly.

**Commands:**
```powershell
cd c:\Users\aldid\modulAIdevelopment\backend
..\venv\Scripts\Activate.ps1
python -c "
from app import create_app
from app.common.exceptions import AppException, CardNotFoundException
from app.common.error_handlers import register_error_handlers
print('All imports OK')
"
```

Expected output: `All imports OK`

---

### Step 12 — Run pytest from `backend/`

**What:** Confirm the existing test suite still passes after all moves and import
updates. Run from `backend/` so Python sees `app/` on `sys.path`.

**Commands:**
```powershell
cd c:\Users\aldid\modulAIdevelopment\backend
..\venv\Scripts\Activate.ps1
pytest tests/test_auth_service.py tests/test_cards_service.py tests/test_comments.py -v --tb=short
```

Expected: all tests that passed before still pass. No `ImportError` or `ModuleNotFoundError`.

---

### Step 13 — Verify Playwright config parses

**What:** From the `e2e/` directory (or passing `--config`), verify that Playwright
can read the new config without errors.

**Commands:**
```powershell
cd c:\Users\aldid\modulAIdevelopment\frontend
npx playwright list-files --config ../e2e/playwright.config.ts
```

Expected: lists `auth.setup.ts`, `auth.spec.ts`, `kanban-journey.spec.ts` with no errors.

---

### Step 14 — Git commit

**What:** Stage all changes and create a single commit documenting the restructure.

**Commands:**
```powershell
cd c:\Users\aldid\modulAIdevelopment
git add backend/ e2e/ specs/ guidelines/ docs/ .env.example
git add .github/workflows/playwright.yml
git add -u   # stage all deletions (old paths)
git status   # review before committing
git commit -m "chore: restructure repository to match target layout in structure.md

- Move app/ → backend/app/, migrations/ → backend/migrations/, tests/ → backend/tests/
- Move app/exceptions.py → backend/app/common/exceptions.py
- Move app/error_handlers.py → backend/app/common/error_handlers.py
- Update all 'from app.exceptions' imports to 'from app.common.exceptions'
- Update 'from app.error_handlers' import to 'from app.common.error_handlers'
- Move frontend/tests/ → e2e/tests/, frontend/playwright.config.ts → e2e/playwright.config.ts
- Update playwright.config.ts webServer.command for new directory depth
- Update .github/workflows/playwright.yml for new e2e/ layout
- Copy .kiro/specs/** → specs/ (originals preserved)
- Create guidelines/ with frontend.md, backend.md, database.md (5+ rules each)
- Create docs/reports/guideline-violations.md, docs/reports/ai-output-comparison.md
- Add root .env.example merging backend and frontend variables"
```

---

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| `app.exceptions` import missed in a file | Search with `Select-String -Recurse "from app.exceptions"` before committing to confirm zero remaining matches |
| `app.error_handlers` import missed | Search with `Select-String -Recurse "from app.error_handlers"` to confirm zero remaining matches |
| Playwright can't find `@playwright/test` module from `e2e/` | `@playwright/test` is in `frontend/node_modules/`; run all `npx playwright` commands from `frontend/` with `--config ../e2e/playwright.config.ts`, or add it as a devDep in a new `e2e/package.json` |
| `auth.setup.ts` `AUTH_FILE` path breaks | The path `path.join(__dirname, "../playwright/.auth/user.json")` is relative to `e2e/tests/` and resolves to `e2e/playwright/.auth/user.json` — correct after `New-Item -Path e2e/playwright/.auth` |
| `frontend/playwright.config.ts` deletion breaks Jest config | `frontend/jest.config.ts` is separate and unaffected; the `frontend` directory still has its own test setup |
| `venv/` is at root; `backend/` changes working directory for pytest | Activation path `../venv/Scripts/Activate.ps1` from `backend/` is correct. pytest's `conftest.py` uses `os.environ.get("TEST_DATABASE_URL", ...)` and `from app.xxx` — these still work from `backend/` |
| `migrations/env.py` uses `current_app.extensions['migrate']` — no path changes needed | `env.py` imports from Flask context, not from `app.*` directly; no changes required |
| `app/.env` and `app/.env.example` are inside `backend/app/` after the move | The `app/config.py` loads from env vars, not from a relative `.env` file. Flask loads `.env` from CWD. After the restructure, run flask from `backend/` so it finds `backend/app/.env`. Document this in README. |
| `git mv frontend/tests` fails if `frontend/tests/` has subdirectories or untracked files | The directory contains only 3 `.ts` files — safe to `git mv` individually as shown |
| `specs/` files getting out of sync with `.kiro/specs/` | The plan notes that `.kiro/specs/` is the authoritative source; `specs/` is a read-only copy for external visibility |

---

## Checklist for the implementing agent

- [ ] `backend/app/`, `backend/migrations/`, `backend/tests/` exist and contain the moved files
- [ ] `backend/app/common/exceptions.py` and `backend/app/common/error_handlers.py` exist
- [ ] Zero occurrences of `from app.exceptions import` remain (search confirms)
- [ ] Zero occurrences of `from app.error_handlers import` remain (search confirms)
- [ ] `e2e/tests/` contains `auth.setup.ts`, `auth.spec.ts`, `kanban-journey.spec.ts`
- [ ] `e2e/playwright.config.ts` has `webServer.command: "npm --prefix ../frontend run dev"`
- [ ] `.github/workflows/playwright.yml` uses `working-directory: frontend` for `npm ci`
- [ ] `specs/` contains copies of all 5 spec files (originals in `.kiro/specs/` untouched)
- [ ] `guidelines/frontend.md`, `guidelines/backend.md`, `guidelines/database.md` each have ≥5 rules in three-part format
- [ ] `docs/reports/guideline-violations.md` exists (copy of VIOLATION_REPORT.md)
- [ ] Root `.env.example` exists with backend + frontend variables
- [ ] `python -c "from app import create_app; print('OK')"` succeeds from `backend/`
- [ ] `pytest tests/ -v --tb=short` passes from `backend/`
- [ ] `npx playwright list-files --config ../e2e/playwright.config.ts` from `frontend/` lists 3 spec files
