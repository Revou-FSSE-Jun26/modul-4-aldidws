---
inclusion: always
---

# Project Structure Standards — RevoTask

## 1. Purpose

This document defines the official repository organization and file placement standards for RevoTask.

The project uses a monorepo structure containing:

- Next.js frontend.
- Flask backend.
- Project specifications.
- Engineering guidelines.
- Automated tests.
- Project documentation.

The repository MUST maintain clear separation between frontend, backend, specifications, and engineering guidelines.

All developers and AI coding agents MUST follow this structure when creating, modifying, or organizing project files.

---

## 2. Root Repository Structure

The repository MUST follow this organization:

```text
RevoTask/
│
├── .github/
│   └── workflows/
│       ├── frontend-ci.yml
│       ├── backend-ci.yml
│       └── e2e-tests.yml
│
├── .kiro/
│   └── steering/
│       └── structure.md
│
├── specs/
│   ├── requirements.md
│   ├── design.md
│   ├── tasks.md
│   ├── CHANGELOG.md
│   │
│   └── playwright/
│       └── requirements.md
│
├── guidelines/
│   ├── frontend.md
│   ├── backend.md
│   └── database.md
│
├── frontend/
│   ├── app/
│   ├── components/
│   ├── features/
│   ├── hooks/
│   ├── lib/
│   ├── providers/
│   ├── public/
│   ├── tests/
│   ├── next.config.ts
│   ├── package.json
│   └── tsconfig.json
│
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── config.py
│   │   ├── extensions.py
│   │   │
│   │   ├── blueprints/
│   │   │   ├── auth/
│   │   │   ├── boards/
│   │   │   ├── columns/
│   │   │   ├── cards/
│   │   │   ├── comments/
│   │   │   ├── notifications/
│   │   │   ├── analytics/
│   │   │   └── users/
│   │   │
│   │   ├── models/
│   │   ├── common/
│   │   └── utils/
│   │
│   ├── migrations/
│   ├── tests/
│   ├── requirements/
│   ├── pyproject.toml
│   ├── wsgi.py
│   └── requirements.txt
│
├── e2e/
│   ├── tests/
│   ├── pages/
│   ├── fixtures/
│   ├── utils/
│   └── playwright.config.ts
│
├── docs/
│   ├── adr/
│   └── reports/
│       ├── ai-output-comparison.md
│       └── guideline-violations.md
│
├── .env.example
├── .gitignore
└── README.md
```

**Important:** The `frontend/app/` directory belongs to Next.js, while `backend/app/` belongs to Flask. They MUST remain separate.

---

## 3. Specification Directory — `/specs`

The `/specs` directory contains the official project requirements, architecture design, implementation tasks, and refinement history.

```text
specs/
├── requirements.md
├── design.md
├── tasks.md
├── CHANGELOG.md
└── playwright/
    └── requirements.md
```

### File Responsibilities

| File                         | Responsibility                                                                     |
| ---------------------------- | ---------------------------------------------------------------------------------- |
| `requirements.md`            | Defines functional and non-functional requirements with acceptance criteria.       |
| `design.md`                  | Maps acceptance criteria to Flask routes and Next.js pages.                        |
| `tasks.md`                   | Maps every route and page to actionable implementation tasks.                      |
| `CHANGELOG.md`               | Documents AI-generated specification refinement rounds with before/after evidence. |
| `playwright/requirements.md` | Defines end-to-end testing requirements and acceptance criteria.                   |

### Rules

1. All approved functional and non-functional requirements MUST be documented in `requirements.md`.
2. Every requirement MUST have at least one acceptance criterion.
3. Every acceptance criterion MUST map to an implementation location in `design.md`.
4. Every documented Flask route and Next.js page MUST have a corresponding task in `tasks.md`.
5. Every meaningful specification refinement MUST be recorded in `CHANGELOG.md`.
6. Changes to requirements MUST trigger a review of the design and task traceability.
7. Do not place application source code inside `/specs`.

---

## 4. Engineering Guidelines Directory — `/guidelines`

The `/guidelines` directory contains the engineering standards used by developers and AI coding agents.

```text
guidelines/
├── frontend.md
├── backend.md
└── database.md
```

### File Responsibilities

| File          | Scope                                                                                                      |
| ------------- | ---------------------------------------------------------------------------------------------------------- |
| `frontend.md` | Next.js architecture, React components, hooks, client/server boundaries, UI, and frontend API consumption. |
| `backend.md`  | Flask Blueprints, routes, services, validation, authentication, authorization, and error handling.         |
| `database.md` | PostgreSQL schema, SQLAlchemy models, relationships, constraints, indexes, and migrations.                 |

### Required Guideline Format

Every guideline MUST follow this three-part structure:

```markdown
## Guideline Title

### Rule

[The mandatory engineering rule.]

### Rationale

[Why the rule exists and which engineering problem it prevents.]

### RevoTask Example

[Concrete implementation example using the actual project architecture.]
```

### Rules

1. Each guideline MUST have a clearly defined technical scope.
2. Frontend rules MUST NOT duplicate backend implementation responsibilities.
3. Backend rules MUST NOT redefine database schema and relationship conventions.
4. Database rules MUST NOT contain frontend or HTTP route implementation instructions.
5. Contradictory rules between the three files MUST be resolved.
6. Guideline changes MUST be reviewed against existing implementation.
7. AI-generated guideline violations MUST be documented in `docs/reports/guideline-violations.md` or an equivalent documented report.

---

## 5. Frontend Directory — `/frontend`

The frontend is built using Next.js, React, TypeScript, and Tailwind CSS.

```text
frontend/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   └── register/
│   │
│   ├── (dashboard)/
│   │   ├── dashboard/
│   │   ├── boards/
│   │   │   └── [boardId]/
│   │   ├── my-tasks/
│   │   └── profile/
│   │
│   ├── layout.tsx
│   ├── page.tsx
│   ├── loading.tsx
│   ├── error.tsx
│   ├── not-found.tsx
│   └── globals.css
│
├── components/
│   ├── shared/
│   │   ├── Header.tsx
│   │   ├── Sidebar.tsx
│   │   ├── Modal.tsx
│   │   ├── Loading.tsx
│   │   └── EmptyState.tsx
│   │
│   ├── ui/
│   └── layout/
│
├── features/
│   ├── auth/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── services/
│   │   └── types/
│   │
│   ├── boards/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── services/
│   │   └── types/
│   │
│   ├── columns/
│   │   ├── components/
│   │   ├── services/
│   │   └── types/
│   │
│   ├── cards/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── services/
│   │   └── types/
│   │
│   ├── comments/
│   ├── notifications/
│   └── analytics/
│
├── hooks/
│   ├── useAuth.ts
│   └── useDebounce.ts
│
├── lib/
│   ├── api/
│   │   ├── client.ts
│   │   ├── errors.ts
│   │   └── config.ts
│   │
│   ├── auth/
│   ├── constants/
│   └── utils/
│
├── providers/
│   └── AuthProvider.tsx
│
├── public/
├── tests/
│   ├── unit/
│   ├── components/
│   └── integration/
│
├── package.json
├── next.config.ts
└── tsconfig.json
```

### 5.1 App Router — `/frontend/app`

Responsible for:

- Next.js routes and pages.
- Root and nested layouts.
- Route-level loading states.
- Route-level error boundaries.
- Not-found handling.
- Route metadata.

Page components MUST focus on route composition and delegate reusable feature behavior to the appropriate feature modules.

### 5.2 Shared Components — `/frontend/components/shared`

Contains reusable components used across multiple features.

Examples:

- Header.
- Sidebar.
- Modal.
- Loading indicators.
- Empty states.

Feature-specific components MUST remain inside their corresponding `/frontend/features/` directory.

### 5.3 Hooks — `/frontend/hooks`

Contains reusable React hooks that are shared across multiple features.

Feature-specific hooks MUST remain within the corresponding feature directory.

### 5.4 Library — `/frontend/lib`

Contains infrastructure and general-purpose utilities.

Examples:

- Shared API client.
- API error normalization.
- Authentication utilities.
- Constants.
- General utility functions.

Do not place feature-specific business logic inside `lib/`.

### 5.5 Feature Modules — `/frontend/features`

Each feature MUST own its relevant components, hooks, API services, and types.

Examples:

- `features/boards/` manages board-related frontend behavior.
- `features/cards/` manages card-related frontend behavior.
- `features/comments/` manages comment-related frontend behavior.

Feature modules MUST NOT access the Flask database directly.

---

## 6. Backend Directory — `/backend`

The backend is built using Flask, Python, PostgreSQL, and SQLAlchemy.

```text
backend/
├── app/
│   ├── __init__.py
│   ├── config.py
│   ├── extensions.py
│   │
│   ├── blueprints/
│   │   ├── auth/
│   │   │   ├── __init__.py
│   │   │   ├── routes.py
│   │   │   ├── schemas.py
│   │   │   └── service.py
│   │   │
│   │   ├── boards/
│   │   ├── columns/
│   │   ├── cards/
│   │   ├── comments/
│   │   ├── notifications/
│   │   ├── analytics/
│   │   └── users/
│   │
│   ├── models/
│   │   ├── user.py
│   │   ├── board.py
│   │   ├── board_member.py
│   │   ├── column.py
│   │   ├── card.py
│   │   ├── comment.py
│   │   └── notification.py
│   │
│   ├── common/
│   │   ├── exceptions.py
│   │   ├── error_handlers.py
│   │   ├── responses.py
│   │   ├── permissions.py
│   │   └── logging.py
│   │
│   └── utils/
│
├── migrations/
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── api/
│   └── security/
│
├── requirements/
│   ├── base.txt
│   ├── development.txt
│   └── testing.txt
│
├── pyproject.toml
├── requirements.txt
└── wsgi.py
```

### 6.1 Flask Blueprints — `/backend/app/blueprints`

Each feature MUST have its own Blueprint module.

Required feature modules:

- `auth`
- `boards`
- `columns`
- `cards`
- `comments`
- `notifications`
- `analytics`
- `users`

Each implemented feature SHOULD contain:

| File          | Responsibility                                           |
| ------------- | -------------------------------------------------------- |
| `routes.py`   | HTTP endpoint definitions and request/response handling. |
| `schemas.py`  | Request validation and response serialization.           |
| `service.py`  | Feature-specific business operations.                    |
| `__init__.py` | Blueprint creation and exports, when needed.             |

Routes MUST remain thin and MUST delegate business operations to the service layer.

Do not create empty or placeholder Blueprints merely to satisfy the directory structure. A Blueprint becomes part of the implemented API when its routes and expected behavior are actually available.

### 6.2 Models — `/backend/app/models`

Contains SQLAlchemy model definitions.

Each model MUST follow `database.md`.

Examples:

- User.
- Board.
- BoardMember.
- Column.
- Card.
- Comment.
- Notification.

### 6.3 Common Infrastructure — `/backend/app/common`

Contains backend infrastructure shared across multiple Blueprints.

Examples:

- Custom exceptions.
- Global error handlers.
- Standard API response helpers.
- Permission utilities.
- Structured logging.

Feature-specific business logic MUST NOT be placed in this directory.

---

## 7. End-to-End Testing Directory — `/e2e`

Playwright tests are maintained separately from application source code.

```text
e2e/
├── tests/
│   ├── auth.spec.ts
│   ├── boards.spec.ts
│   ├── cards.spec.ts
│   └── kanban-journey.spec.ts
│
├── pages/
│   ├── LoginPage.ts
│   ├── DashboardPage.ts
│   └── BoardPage.ts
│
├── fixtures/
│   ├── auth.fixture.ts
│   └── test-data.fixture.ts
│
├── utils/
│
└── playwright.config.ts
```

Rules:

1. End-to-end tests MUST verify actual user workflows.
2. Page Objects MUST be used for reusable page interactions.
3. Tests MUST NOT use `waitForTimeout`.
4. Tests MUST use reliable locators and condition-based waiting.
5. Critical Kanban workflows MUST verify persisted card positions after page reload.
6. Production test execution MUST use the configured public application URL.
7. Test reports MUST be retained as project evidence.

The full testing requirements are defined in `/specs/playwright/requirements.md`.

---

## 8. Documentation and Evidence — `/docs`

```text
docs/
├── adr/
│   └── README.md
│
└── reports/
    ├── ai-output-comparison.md
    └── guideline-violations.md
```

Responsibilities:

- `adr/`: Records important architecture decisions and their rationale.
- `ai-output-comparison.md`: Records measurable AI output quality before and after applying engineering guidelines.
- `guideline-violations.md`: Records actual AI-generated code violations, the violated guideline, and the applied correction.

Evidence MUST be based on actual generated code, reviews, tests, or repository changes.

Do not fabricate test results or AI output comparisons.

---

## 9. Environment and Configuration Files

### 9.1 Environment Variables

The repository MUST include a committed `.env.example` file.

Example:

```env
# Backend
FLASK_ENV=development
SECRET_KEY=replace-with-local-secret
DATABASE_URL=postgresql://user:password@localhost:5432/revotask

# Frontend
NEXT_PUBLIC_API_BASE_URL=http://localhost:5000/api/v1
```

Rules:

1. `.env.example` MUST contain variable names and safe placeholder values.
2. Real credentials MUST NOT be committed.
3. Frontend public variables MUST NOT contain secrets.
4. Backend secrets MUST remain server-side.
5. Each deployment environment MUST use its own configuration.

### 9.2 Git Ignore

The root `.gitignore` MUST exclude:

```gitignore
# Environment files
.env
.env.*
!.env.example

# Python
__pycache__/
*.py[cod]
.venv/
venv/
.pytest_cache/
.mypy_cache/

# Next.js
.next/
out/
*.tsbuildinfo

# Node.js
node_modules/

# Test artifacts
playwright-report/
test-results/
coverage/

# IDE and operating system
.vscode/
.idea/
.DS_Store
Thumbs.db
```

Do not commit actual environment files, generated dependencies, Python cache files, or Next.js build output.

Test reports intended as assignment evidence MUST be explicitly retained or uploaded as CI artifacts rather than accidentally discarded.

---

## 10. Naming Conventions

| Item                 | Convention                             | Example            |
| -------------------- | -------------------------------------- | ------------------ |
| React components     | PascalCase                             | `BoardCard.tsx`    |
| React hooks          | camelCase with `use`                   | `useAuth.ts`       |
| TypeScript utilities | camelCase                              | `formatDate.ts`    |
| Flask modules        | snake_case                             | `board_service.py` |
| SQLAlchemy models    | PascalCase                             | `BoardMember`      |
| Database tables      | snake_case                             | `board_members`    |
| API endpoints        | lowercase plural nouns                 | `/api/boards`      |
| Test files           | descriptive suffix                     | `cards.spec.ts`    |
| Documentation        | lowercase kebab-case or specified name | `requirements.md`  |
| Environment examples | `.env.example`                         | `.env.example`     |

Use the naming conventions defined in the relevant engineering guideline when a more specific convention exists.

---

## 11. Dependency and Import Boundaries

### Frontend

- App Router pages MAY import shared components and feature modules.
- Feature modules MAY import shared libraries and shared components.
- Shared components MUST NOT depend on feature-specific modules.
- Shared hooks MUST NOT depend on a specific feature.
- API transport logic MUST remain in `lib/api/`.
- Feature API operations MUST remain in the relevant feature service.

### Backend

- Flask routes MAY call their corresponding feature services.
- Feature services MAY use models and shared backend infrastructure.
- Models MUST NOT import Flask route modules.
- Common infrastructure MUST NOT depend on individual feature implementations.
- Database access MUST follow the service and transaction boundaries defined in `backend.md`.

### Cross-Application

- Frontend MUST communicate with Flask through documented API contracts.
- Frontend MUST NOT import Python backend modules.
- Backend MUST NOT depend on frontend source code.
- Shared business rules MUST be represented consistently through requirements and API contracts.

---

## 12. Adding a New Feature

When adding a new RevoTask feature:

1. Update `/specs/requirements.md` with approved requirements and acceptance criteria.
2. Update `/specs/design.md` with the corresponding Next.js pages, Flask routes, and data flow.
3. Update `/specs/tasks.md` with implementation tasks and traceability references.
4. Add the frontend feature under `/frontend/features/`.
5. Add the backend Blueprint under `/backend/app/blueprints/`.
6. Add or update database models only when required.
7. Update relevant API contracts and engineering guidelines when necessary.
8. Add appropriate unit, integration, and end-to-end tests.
9. Update `/specs/CHANGELOG.md` when a meaningful specification refinement occurs.
10. Verify that the implementation follows the project's Definition of Done.

Do not create unnecessary folders or modules for functionality that has not been approved.

---

## 13. Existing Repository Compatibility

This document defines the target repository structure.

It MUST NOT be interpreted as permission to move or rename the entire existing project automatically.

Before reorganizing existing files, AI coding agents MUST:

1. Inspect the actual repository structure.
2. Identify existing Next.js and Flask entry points.
3. Identify existing imports, aliases, and configuration references.
4. Identify deployment assumptions.
5. Propose the smallest safe migration.
6. Update affected imports, scripts, and CI configuration.
7. Verify builds and tests after migration.

Never move the Next.js `app/` directory into the Flask `app/` package.

Avoid large structural migrations during unrelated feature implementation.

---

## 14. AI Coding Agent Instructions

AI coding agents MUST:

1. Follow this directory structure when creating new files.
2. Inspect existing files before creating replacements.
3. Place each file in the correct application or documentation directory.
4. Follow the relevant file in `/guidelines/`.
5. Preserve existing working functionality.
6. Avoid duplicate components, services, models, and utilities.
7. Update related specifications when architecture or behavior changes.
8. Keep frontend and backend dependencies separated.
9. Never commit secrets or generated dependency directories.
10. Avoid creating unused placeholder modules.
11. Verify imports, builds, and tests after structural changes.
12. Report deviations from the target structure explicitly.

---

## 15. Definition of Done

A structural change is complete only when:

- [ ] Files are placed in the correct directory.
- [ ] Frontend and backend responsibilities remain separated.
- [ ] No duplicate modules or unnecessary folders are introduced.
- [ ] Import paths and aliases are valid.
- [ ] Environment configuration is correct.
- [ ] `.gitignore` excludes sensitive and generated files.
- [ ] Related specifications and tasks are updated.
- [ ] Relevant tests and build checks pass.
- [ ] Existing deployment configuration remains valid.

---

## 16. Engineering Decision Priority

When repository organization decisions conflict, follow this priority:

1. Approved project requirements.
2. System architecture and application boundaries.
3. Security and secret management.
4. Existing working repository compatibility.
5. Frontend, backend, and database guidelines.
6. Maintainability and testability.
7. Consistent directory organization.
8. Developer convenience.
