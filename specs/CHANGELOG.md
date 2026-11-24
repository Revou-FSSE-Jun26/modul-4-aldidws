# Changelog — RevoTask

All notable changes to this project are documented in this file.

This changelog follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Changed

- Specifications rewritten for the Kanban product (see Refinement 1, 2026-11-24). Documentation only.
- Kanban UI built on the backend (board read, card list and search, notifications producer, card soft delete, column delete 409) and the frontend (create board, columns, cards, drag and drop, card dialog with comments, search, bell, My Tasks, Profile, header). Decisions D6, D8 and D13 changed (Refinements 2 to 6). Not committed yet.

---

## AI Improvement Log

The entries below document concrete defects found in AI-generated code during development
and the corrections applied. Each entry follows the structure:
**Context/Problem → Before (initial AI output) → Prompt used → After (corrected output)**.

---

### Fix 1 — Card ordering column: `Integer position` → `Float order`

**Context / Problem:**
The initial AI-generated `Card` model used an `Integer` column named `position` for
ordering cards within a column. This strategy requires renumbering every card whenever
one is inserted between two existing cards (e.g. inserting between position 1 and 2
requires shifting all subsequent cards). The database guideline (`database.md §11`) and
the rubric explicitly require a `Float` column named `order` to allow midpoint insertion
(e.g. `1.5` between `1.0` and `2.0`) without touching other rows.

**Before (initial AI output):**

```python
# app/models/card.py
position: Mapped[int] = mapped_column(
    Integer,
    nullable=False,
    default=0,
)
```

```python
# app/blueprints/cards/schema.py
class CardPositionSchema(Schema):
    column_id = fields.UUID(required=True)
    position = fields.Integer(required=True, validate=validate.Range(min=0))
```

**Prompt used:**

> "Change `position` (Integer) column to `order = db.Column(db.Float, nullable=False)`
> to support FLOAT order strategy. Adjust all `position` references to `order` in
> `cards/schema.py`, `cards/service.py`, and `cards/routes.py`."

**After (corrected output):**

```python
# app/models/card.py
order: Mapped[float] = mapped_column(
    Float,
    nullable=False,
    default=0.0,
)
__table_args__ = (
    CheckConstraint('"order" >= 0', name="ck_cards_order_nonnegative"),
    Index("ix_cards_column_id_order", "column_id", "order"),
)
```

```python
# app/blueprints/cards/schema.py
class CardPositionSchema(Schema):
    column_id = fields.UUID(required=True)
    order = fields.Float(required=True, validate=validate.Range(min=0))
```

---

### Fix 2 — Business logic inside route handler → moved to `service.py`

**Context / Problem:**
The initial AI-generated `comments/routes.py` contained board-ownership validation and
card-lookup logic directly inside the route handler, violating `backend.md §3`
("Routes MUST remain thin and focused on HTTP responsibilities") and §4
("The service layer MUST contain application use cases and business logic").

**Before (initial AI output):**

```python
# app/blueprints/comments/routes.py
@comments_bp.route("/<card_id>/comments", methods=["POST"])
@token_required
def create_comment(current_user, card_id):
    # Business logic embedded in the route handler — violates backend.md §3
    card = db.session.get(Card, uuid.UUID(card_id))
    if card is None:
        return jsonify({"error": {"code": "NOT_FOUND", "message": "Card not found"}}), 404
    board = db.session.get(Board, card.column.board_id)
    if board.owner_id != current_user.id:
        return jsonify({"error": {"code": "FORBIDDEN", "message": "Access denied"}}), 403
    data = CreateCommentSchema().load(request.get_json() or {})
    comment = CardComment(card_id=card.id, author_id=current_user.id, body=data["body"])
    db.session.add(comment)
    db.session.commit()
    return jsonify({"data": comment_to_dict(comment)}), 201
```

**Prompt used:**

> "Move all board-ownership verification and card-lookup logic out of the route handler
> into `comments/service.py`. The route should only validate the request body, call the
> service function, and return the serialised response."

**After (corrected output):**

```python
# app/blueprints/comments/routes.py  — thin handler
@comments_bp.route("/<card_id>/comments", methods=["POST"])
@token_required
def create_comment(current_user, card_id):
    data = CreateCommentSchema().load(request.get_json() or {})
    comment = service.create_comment(current_user, uuid.UUID(card_id), data)
    return jsonify({"data": comment_to_dict(comment)}), 201

# app/blueprints/comments/service.py  — business logic
def create_comment(current_user, card_id: uuid.UUID, data: dict) -> CardComment:
    card = _get_card_for_user(current_user, card_id)   # ownership check inside
    comment = CardComment(card_id=card.id, author_id=current_user.id, body=data["body"])
    db.session.add(comment)
    db.session.commit()
    return comment
```

---

### Fix 3 — Non-standard API error envelope → standardised `{"error": {...}}`

**Context / Problem:**
Several AI-generated route handlers returned ad-hoc error strings such as
`{"error": "Card not found"}` (a plain string) instead of the structured envelope
defined in `backend.md §8`: `{"error": {"code": "...", "message": "...", "details": null}}`.
This broke the frontend `isFlaskErrorEnvelope` type guard in `lib/errors.ts`.

**Before (initial AI output):**

```python
# Multiple route handlers
return jsonify({"error": "Card not found"}), 404
return jsonify({"error": "Unauthorized"}), 401
return jsonify({"error": "Invalid data"}), 400
```

**Prompt used:**

> "Standardise all error responses to use the envelope format
> `{'error': {'code': '...', 'message': '...', 'details': null}}`.
> Register global error handlers in `app/error_handlers.py` for `AppException`,
> `marshmallow.ValidationError`, and generic `Exception` so routes never format
> errors themselves."

**After (corrected output):**

```python
# app/error_handlers.py
@app.errorhandler(AppException)
def handle_app_exception(err: AppException):
    return jsonify({
        "error": {"code": err.error_code, "message": err.message, "details": err.details}
    }), err.status_code

@app.errorhandler(ValidationError)
def handle_validation_error(err: ValidationError):
    return jsonify({
        "error": {"code": "VALIDATION_ERROR",
                  "message": "The request contains invalid data",
                  "details": err.messages}
    }), 400
```

---

### Fix 4 — `waitForTimeout` in Playwright tests → replaced with auto-waiting assertions

**Context / Problem:**
The initial AI-generated Playwright test file (`kanban-journey.spec.ts`) contained
`await page.waitForTimeout(2000)` calls to wait for UI transitions. This violates
`testing.md §15` ("Flaky tests MUST be investigated. Do not use retries to conceal
underlying instability") and the Playwright specification which explicitly prohibits
`waitForTimeout`. Hardcoded delays make tests slow and brittle.

**Before (initial AI output):**

```typescript
// frontend/tests/kanban-journey.spec.ts
await col1Region.getByRole("button", { name: /add card/i }).click();
await page.waitForTimeout(2000); // ← prohibited
await page.getByRole("textbox", { name: /card title/i }).fill(CARD_TITLE);
await page.waitForTimeout(1000); // ← prohibited
await page.getByRole("button", { name: /^add card$|^save$/i }).click();
```

**Prompt used:**

> "Remove ALL `waitForTimeout` calls from Playwright tests. Replace with Playwright's
> built-in auto-waiting: use `expect(locator).toBeVisible()`, `expect(locator).toHaveCount()`,
> or `await locator.click()` directly — Playwright auto-waits for elements to be
> actionable before interacting."

**After (corrected output):**

```typescript
// frontend/tests/kanban-journey.spec.ts
await col1Region.getByRole("button", { name: /add card/i }).click();
// No waitForTimeout — Playwright auto-waits for the textbox to be actionable
await page.getByRole("textbox", { name: /card title/i }).fill(CARD_TITLE);
await page.getByRole("button", { name: /^add card$|^save$/i }).click();
await expect(
  col1Region.getByRole("listitem", { name: CARD_TITLE }),
).toBeVisible();
```

---

### Fix 5 — Raw `<button>` in login/register pages → `<BaseButton>` shared component

**Context / Problem:**
The AI-generated `app/login/page.tsx` used a raw HTML `<button>` element styled with
inline Tailwind classes instead of the project's shared `<BaseButton>` component.
This violates `frontend.md §2.5` ("MUST place genuinely shared UI primitives in
`components/shared/`") and §4.8 ("SHOULD use a `Base` prefix for generic shared
primitives when consistent with the existing project convention"). It also duplicated
the button variant styling in every page, making visual consistency harder to maintain.

**Before (initial AI output):**

```tsx
// app/login/page.tsx
<button
  type="submit"
  disabled={isSubmitting}
  className="mt-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium
             text-white hover:bg-blue-700 focus:outline-none
             focus-visible:ring-2 focus-visible:ring-blue-500
             disabled:cursor-not-allowed disabled:opacity-60"
>
  {isSubmitting ? "Signing in…" : "Sign in"}
</button>
```

**Prompt used:**

> "Replace the raw `<button>` element in `app/login/page.tsx` and the new
> `app/register/page.tsx` with `<BaseButton type='submit' variant='primary'
disabled={isSubmitting}>` from `@/components/shared/BaseButton`.
> Preserve all existing behavior — only the wrapper element changes."

**After (corrected output):**

```tsx
// app/login/page.tsx
import { BaseButton } from "@/components/shared/BaseButton";
// ...
<BaseButton type="submit" variant="primary" disabled={isSubmitting}>
  {isSubmitting ? "Signing in…" : "Sign in"}
</BaseButton>;
```

---

## Specification Refinement Log

Each entry records a change to the specifications in `specs/`: **Context -> Before -> After -> Evidence**.

---

### Refinement 1: Task/Project specification replaced by a Kanban specification (2026-11-24)

**Context / Problem:**
The specifications described a Task and Project application (tasks with status, priority and due date, overdue and due-today filters, four sorting modes, an activity log). The code that was built is a Kanban application: boards, columns, cards with a Float `order` and a `deleted_at` column, comments, notifications, analytics and a user profile. The gap analysis in `.agents/tasks/requirements-gap-report.md` (section 1, point 4) found that old Requirements 2 to 9 and 12 had no counterpart in the code, and that Kanban, drag and drop, comments and notifications appeared only under "Future Enhancements" (old requirements section 10), with analytics listed as out of scope (old section 9). The same report found that a logged-in user could not complete the Kanban flow through the UI and that several frontend payloads were rejected by the backend (section 4). The product owner chose Kanban (Q1 in section 7 of the report). Mapping: Task became Card, Project became Board.

**Before (`specs/*.md` in the working tree at commit `339dfe3`, counted before the rewrite):**

| File              | Lines | Content                                                                                                                                                                                                                    |
| ----------------- | ----: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `requirements.md` |   444 | 12 requirements, 107 acceptance criteria: Task create, view, edit, delete, status and priority, Project organization, filter and search, sorting, persistence, API, activity tracking. Admin role. Render as backend host. |
| `design.md`       |   698 | Task-based components and data models, 19 correctness properties (for example "Project deletion unassigns tasks atomically", "Overdue filter correctness").                                                                |
| `tasks.md`        |   390 | 42 top-level tasks for the Task/Project app.                                                                                                                                                                               |

Examples of statements that did not match the code:

- Requirement 7.9 and Property 14: deleting a project sets its tasks' `project_id` to null. Cards have no `project_id` and belong to a column.
- Requirement 5.2: a task is permanently deleted. The `cards` table has `deleted_at`.
- Requirement 11.1: every route under `/api/v1`. Only the cards routes are.
- Section 7: hosting on Render. The deployment documents describe Railway.

**After (this refinement):**

| File              | Lines | Content                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ----------------- | ----: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `requirements.md` |   395 | 14 requirements (R1 to R14) with 101 numbered acceptance criteria, plus 26 numbered non-functional criteria (N1 to N6). Each criterion is tagged `[Done]` (42), `[BE]` (23) or `[Plan]` (62). Section 12 lists 13 open decisions (D1 to D13).                                                                                                                                                                                                                          |
| `design.md`       |   486 | System overview, data model as implemented, a table of 25 routes with real field names, the extra URLs created by double blueprint registration, frontend pages and components with their status, data flows (board read, create, move, delete, session), contract mismatches with the chosen resolution, error handling and validation tables, an invariant ownership table, security notes, and traceability tables from every criterion to routes, pages and tests. |
| `tasks.md`        |   295 | 36 tasks (T0, B1 to B12, F1 to F13, C1, E1, X1, P1 to P7) with size, dependencies, requirement references and tests, and a coverage table for every route and page.                                                                                                                                                                                                                                                                                                    |

Counts for "After" were taken from the files after the rewrite. Counts for "Before" were taken from the files before it.

**Old requirement to new requirement:**

| Old                                  | New                                                                                               |
| ------------------------------------ | ------------------------------------------------------------------------------------------------- |
| R1 Authentication                    | R1, R9 (session limits)                                                                           |
| R2, R4, R5 Create, edit, delete Task | R4 Cards                                                                                          |
| R3 View Tasks                        | R2.3, R2.5 (board list and board read)                                                            |
| R6 Status and priority               | Removed. The column is the status (D9).                                                           |
| R7 Projects                          | R2 Boards, R3 Columns                                                                             |
| R8 Filter and search                 | R8 Search (title and description, one board)                                                      |
| R9 Sorting                           | Removed (D9)                                                                                      |
| R10 Persistence                      | R12                                                                                               |
| R11 API and errors                   | R10                                                                                               |
| R12 Activity tracking                | Removed (D12)                                                                                     |
| none                                 | R5 Move and reorder, R6 Comments, R7 Profile, R11 Authorization, R13 Analytics, R14 Notifications |

**Evidence used:**

- Gap analysis: `.agents/tasks/requirements-gap-report.md` (sections 2, 4, 7).
- Code read for the rewrite: `backend/app/__init__.py`, every `blueprints/*/routes.py`, `schema.py` and `service.py`, `backend/app/models/*.py`, `common/error_handlers.py`, `common/exceptions.py`, `config.py`, `backend/migrations/versions`, `frontend/app`, `frontend/components`, `frontend/hooks`, `frontend/lib`, `frontend/context`, `e2e/`.
- Verified in code while writing, and different from what the gap report or the decisions assumed:
  - `delete_card` removes the row (`db.session.delete`). The gap report called card deletion a soft delete. Only the `deleted_at` column exists. D7 is therefore a change (task B3).
  - Board, column and card deletion rely on database cascade, which is a hard delete (D1).
  - `move_card` renumbers `order` to whole numbers after every move, so the client must reload the board after a move (R5.9) and the backend must break ties in favour of the moved card (R5.10).
  - `move_card` checks ownership of the destination column but not that it is on the same board (R5.3).
  - Comment edit and delete return 403 for a non-author and do not check board ownership (R6.5).
  - Every route calls `uuid.UUID(path_value)`, so an invalid id appears to produce a 500 (R10.11). Read from the code, not executed.
  - The cards, columns and comments blueprints are each registered at two prefixes, which creates extra URLs (design section 5.3).
  - The login response includes a `refresh_token` that no route accepts (R9.5).
  - The model has no priority, status, due date, label or assignee column (D8, D9).
  - `e2e/fixtures/auth.setup.ts` saves browser storage state, which cannot carry an in-memory token, so authenticated e2e tests need a login fixture (task E1).

**Open decisions recorded (defaults chosen, awaiting confirmation):**

| ID  | Default                                                                                                                                      |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Deleting a board deletes its columns and cards, with confirmation. Whether that is soft or hard is still open because the code hard-deletes. |
| D2  | One board read returns columns and cards.                                                                                                    |
| D3  | Deleting a column with cards returns 409.                                                                                                    |
| D4  | Token in memory. A reload requires login. Refresh and logout planned, not MVP.                                                               |
| D5  | Name and timezone editable. Email read-only.                                                                                                 |
| D6  | Notifications out of MVP scope.                                                                                                              |
| D7  | Card delete is a soft delete (a change from current code).                                                                                   |
| D8  | My Tasks and assignee out of scope.                                                                                                          |
| D9  | Search on title and description within one board. No priority, status, due date, labels.                                                     |
| D10 | Target prefix `/api/v1`. Current split documented.                                                                                           |
| D11 | Analytics backend only. Comments in scope.                                                                                                   |
| D12 | Activity log out of scope.                                                                                                                   |
| D13 | Search runs in the browser (added by this refinement).                                                                                       |

**Scope and limits of this change:**

- Documentation only. No application code was changed, and nothing was committed, pushed or deployed.
- No tests, build or server were run. Statements about behaviour come from reading the code.
- `.kiro/specs/` holds an older duplicate spec set (V-028). It was not edited. `specs/` is the authoritative copy.
- `docs/reports/guideline-violations.md` was not changed. Candidate new entries are listed in task X1.

---

Refinements 2 to 6 come from building the Kanban UI (2026-11-24). They are in the working tree and not committed. Each one is a short note added to `requirements.md` section 12.1, `design.md` sections 5.2.1 and 6.3, and `tasks.md`; the original text was kept so the earlier decision stays visible.

### Refinement 2: Notifications moved into scope (D6)

**Context:** the assessment requires a notification bell that shows the number of unread comments. Under D6 nothing created notifications and the bell was not mounted, so the count was always zero.

**Before:** D6 "Out of MVP. Backend routes kept. No UI." Task F13 "no change". R14 "Backend only, no producer, no MVP UI". Design route 23 returned `meta {page, per_page, total}`.

**After:** posting a comment creates one notification for the board owner in the same commit (the owner is notified on their own comments too, because a board has one owner). Route 23 adds `meta.unread_count`. `NotificationBell` is mounted in the new `Header` and marks a notification read through `PATCH /api/notifications/{id}/read`.

**Evidence:** `backend/app/blueprints/notifications/service.py` (`notify_comment_added`), `comments/service.py` (call in `create_comment`), `notifications/routes.py` (`unread_count`), `backend/tests/api/test_notification_routes.py`, `frontend/components/shared/__tests__/NotificationBell.test.tsx`, local Playwright journey (bell shows 2 then 1 after marking one read).

### Refinement 3: My Tasks kept instead of removed (D8)

**Context:** the assessment lists My Tasks among the pages that must load and use `BaseButton`. Task F12 planned to delete the page.

**Before:** D8 "Out of MVP. The `/my-tasks` page is removed (task F12)." `MyTasksList` called `GET /api/cards?assignee=me`, which does not exist.

**After:** `/my-tasks` lists the cards the caller created, grouped by board, with links and "Load more", through `GET /api/v1/cards?mine=true`. Real errors are shown instead of an empty list. There is still no assignee field.

**Evidence:** `frontend/components/board/MyTasksList.tsx`, `frontend/components/board/__tests__/MyTasksList.test.tsx`, `backend/tests/api/test_card_list_routes.py` (`mine` filter).

### Refinement 4: Search moved to the backend with a new card list route (D13)

**Context:** the assessment requires that search finds cards. D13 chose a browser-side filter; one list route serves both search and My Tasks with less frontend code.

**Before:** D13 "In the browser over the loaded board (no new endpoint)." The design route table had 25 routes and no card list. `useCardSearch` called `GET /api/cards`, which does not exist.

**After:** new route `GET /api/v1/cards` with `search` (1 to 100 characters, case-insensitive over title and description, `%` and `_` literal), `board_id`, `mine`, `page`, `per_page` (1 to 100). Only the caller's boards are searched; unknown query keys return 400. The board page search box uses it with `board_id`.

**Evidence:** `backend/app/blueprints/cards/{routes,schema,service}.py`, `backend/tests/api/test_card_list_routes.py`, `frontend/hooks/useCardSearch.ts`, `frontend/components/board/__tests__/SearchBar.test.tsx`.

### Refinement 5: Comment author name and login user name

**Context:** the card dialog showed the author's UUID, and the header needs the user's name right after login.

**Before:** comment object `id, card_id, author_id, body, created_at, updated_at`. Login `user {id, email, role, timezone}`. R6.7 planned to show "You" based on `author_id`.

**After:** comment object adds `author_name` (name, else the part of the email before `@`). Login `user` adds `name`. Both are additive fields.

**Evidence:** `backend/app/blueprints/comments/schema.py`, `backend/app/blueprints/auth/routes.py`, `backend/tests/test_comments.py`, `backend/tests/api/test_auth_routes.py`.

### Refinement 6: Planned backend changes D2, D3, D7 and R5.10 built

**Context:** the board page needs one read, and the decisions D2, D3 and D7 were tagged Planned.

**Before:** route 6 returned the board only ("Planned change"); route 11 deleted a column with its cards; route 15 removed the card row; ties in a move were broken by `created_at`, so a drop at the top could land second.

**After:** route 6 returns `columns[].cards[]` (3 SQL queries); route 11 returns 409 `RESOURCE_CONFLICT` while live cards exist; route 15 sets `deleted_at` and every card read filters it; a moved card wins an `order` tie. The cross-board move check (part of B5) was not built.

**Evidence:** `backend/tests/api/test_board_routes.py`, `test_column_routes.py`, `test_card_routes.py`. Full backend run: 168 passed (pytest, local test database).

---

## Versioned Releases

No versioned releases have been published yet.
Refer to the [Unreleased] section above and the AI Improvement Log for current changes.

[Unreleased]: https://github.com/example/revotask/compare/HEAD
