# Requirements Document: RevoTask (Kanban)

Authoritative copy. `.kiro/specs/` holds an older duplicate set (V-028) and is not maintained.

Basis: working tree at commit `339dfe3`. Every route, field and page below was read from the code. Nothing was run for this rewrite, so "Done" means "the code does this", not "a test run proved it". Where a criterion is not true yet, it carries the tag `[Plan]` or `[BE]`.

## 1. Introduction

RevoTask is a Kanban web application. A registered user owns boards. A board holds ordered columns. A column holds ordered cards. A card has a title, an optional description and comments. The user moves cards between columns and reorders them by drag and drop, and the order persists on the server.

This document replaces the earlier Task/Project specification. That specification described tasks with status, priority, due date, overdue filters, sorting and an activity log. The product that was built is Kanban, and the product owner confirmed Kanban (Q1 in `.agents/tasks/requirements-gap-report.md` section 7). Mapping from the old terms: Task became Card, Project became Board.

### 1.1 Success metrics

- A logged-in user can, using only the UI, create a board, add columns and cards, move cards, comment, and see the same board state after logging in again.
- A user cannot read or change another user's boards, columns, cards or comments.
- Every frontend request payload is accepted by the matching backend schema (no repeat of V-032).
- The critical Kanban journey passes as an automated end-to-end test.

### 1.2 Status legend

Each criterion ends with one tag.

| Tag      | Meaning                                                                              |
| -------- | ------------------------------------------------------------------------------------ |
| `[Done]` | The code does this in backend and, where a UI is involved, in the UI.                |
| `[BE]`   | The backend does this. The UI is missing, unmounted or sends a wrong payload.        |
| `[Plan]` | Not implemented, or implemented differently from the criterion. The text says which. |

A criterion tagged `[Plan]` that depends on a pending decision says `Assumption pending confirmation: Dn`. The decisions are listed in section 12.

## 2. User roles

- **Guest:** can open `/login` and `/register`. Cannot reach any other page or API route.
- **Member:** an authenticated user. Can own boards and be a member of other users' boards. Role value `member`.
- **Admin:** the `users.role` column allows `admin`, but no feature uses it. Admin features are out of scope.

**Board sharing model:** A board has one `owner_id` (the user who created it) and zero or more `board_members` (role `member`). The `board_members` table determines read access: any user in `board_members` (including the owner, who is implicitly a member) can read the board and its cards. The owner can invite registered accounts by email (`POST /api/boards/{board_id}/members`), list members (`GET /api/boards/{board_id}/members`), and remove members (`DELETE /api/boards/{board_id}/members/{member_user_id}`). A member can modify or move their own cards or cards assigned to them (`card_assignees`). The `owner_id` field is kept for compatibility but access checks use `board_members`.

## 3. Glossary

- **Board:** a named Kanban board owned by one user.
- **Column:** a named, ordered lane inside a board. Table `board_columns`, order field `position`.
- **Card:** a unit of work inside a column. Table `cards`, order field `order` (Float).
- **Comment:** a text note on a card, written by a user. Table `card_comments`.
- **Soft delete:** the row stays and `deleted_at` is set. Only `cards` has this column.
- **Envelope:** the JSON wrapper `{"data": ...}` on success and `{"error": {code, message, details}}` on failure.

## 4. Requirement summary

| Req | Title                                           | Status                                                                    |
| --- | ----------------------------------------------- | ------------------------------------------------------------------------- |
| R1  | Authentication, route protection and navigation | Backend done. Logout button, header and `/profile` guard Planned          |
| R2  | Boards                                          | Backend done except board read with contents (D2). UI Planned except list |
| R3  | Columns                                         | Backend done except delete rule (D3). UI Planned                          |
| R4  | Cards                                           | Backend done except soft delete (D7). UI Planned                          |
| R5  | Move and reorder cards                          | Backend done except same-board check. UI Planned                          |
| R6  | Comments                                        | Backend done. UI Planned                                                  |
| R7  | Profile                                         | Backend done. UI sends a wrong payload                                    |
| R8  | Search                                          | Planned                                                                   |
| R9  | Session lifetime                                | MVP limitation documented. Refresh and logout Planned, not in MVP         |
| R10 | API contract and errors                         | Mostly done. Prefix and naming drift documented                           |
| R11 | Authorization and ownership                     | Done in backend. Two gaps Planned                                         |
| R12 | Data persistence and integrity                  | Done except two gaps Planned                                              |
| R13 | Analytics                                       | Backend only, no MVP UI                                                   |
| R14 | Notifications                                   | Backend only, no producer, no MVP UI                                      |
| R15 | Card due dates                                  | Planned (kanban-features phase 1)                                         |
| R16 | Board labels                                    | Planned (kanban-features phase 2)                                         |
| R17 | Board filter                                    | Planned (kanban-features phase 3)                                         |

## 5. Functional requirements

### Requirement 1: Authentication, route protection and navigation

**User story:** As a Guest, I want to register and log in, so that I can reach my boards.

Status: backend Done. UI: register and login pages Done. Header, logout button and a guard on `/profile` Planned.

#### Acceptance criteria

- **R1.1** WHEN a Guest submits `name` (1 to 255 characters after trimming), a valid `email` and a `password`, THE backend SHALL create a user with role `member` and timezone `UTC` and return 201 with the user, without the password hash. `[Done]` (`POST /api/auth/register`)
- **R1.2** THE backend SHALL require the password to have at least 8 characters, one lowercase letter, one uppercase letter and one digit, and SHALL return 400 `VALIDATION_ERROR` with per-field `details` otherwise. `[Done]`
- **R1.3** IF the email already exists (compared in lowercase), THEN THE backend SHALL return 409 `RESOURCE_CONFLICT` with a generic message. `[Done]`
- **R1.4** IF a request body contains an unknown field, THEN THE backend SHALL return 400 `VALIDATION_ERROR` naming the field. `[Done]`
- **R1.5** WHEN a user submits a valid email and password to `POST /api/auth/login`, THE backend SHALL return 200 with `access_token` (JWT, HS256, 15 minutes) and `user` (`id`, `email`, `role`, `timezone`). `[Done]`
- **R1.6** IF the email is unknown or the password is wrong, THEN THE backend SHALL return 401 `INVALID_CREDENTIALS` with the same message for both cases. `[Done]`
- **R1.7** IF a login password does not satisfy the registration password policy, THEN THE backend SHALL still return 401 `INVALID_CREDENTIALS`, not 400. `[Plan]` Current: `LoginSchema` applies the policy and returns 400. Matters only for accounts created before the policy.
- **R1.8** WHEN a request to any route other than register, login and health has no valid Bearer token, THE backend SHALL return 401 `UNAUTHORIZED`. `[Done]`
- **R1.9** WHEN an unauthenticated visitor opens any page except `/login` and `/register`, THE frontend SHALL redirect to `/login`. `[Plan]` Current: `/` and `/boards/[id]` redirect through `useRequireAuth`. `/profile` and `/my-tasks` read `useAuth` without redirecting.
- **R1.10** WHEN a login succeeds, THE frontend SHALL navigate to `/`. `[Done]`
- **R1.11** WHILE a user is authenticated, THE frontend SHALL show a header on every authenticated page with links to Boards (`/`) and Profile (`/profile`) and a Log out button. `[Plan]`
- **R1.12** WHEN the user chooses Log out, THE frontend SHALL clear the in-memory token and user and navigate to `/login`. `[Plan]` Current: `AuthContext.logout()` clears state, but no button calls it. Limitation: the server does not invalidate the access token, so it stays valid until it expires (15 minutes). See R9.
- **R1.13** THE backend SHALL store only a password hash. `[Done]` (Werkzeug `generate_password_hash`; the algorithm does not match `security.md` section 3.2, see N1.8)

### Requirement 2: Boards

**User story:** As a Member, I want to create and manage boards, so that I can separate areas of work.

Status: backend Done except R2.5. UI: list Done. Create, open with contents, rename, delete Planned.

#### Acceptance criteria

- **R2.1** WHEN a Member submits `name` (1 to 100 characters after trimming, not blank), THE backend SHALL create a board owned by the caller and return 201 with `id`, `name`, `user_id`, `created_at`, `updated_at`. `[BE]` (`POST /api/boards`)
- **R2.2** IF the caller already owns a board with the same name (case-insensitive), THEN THE backend SHALL return 409 `RESOURCE_CONFLICT`. Different users MAY use the same name. `[BE]` Enforced in the service only. There is no database unique index (see R12.5).
- **R2.3** WHEN a Member opens `/`, THE frontend SHALL list only the Member's boards, oldest first, with loading, empty and error states, and a "Create board" control. `[BE]` Current: list, loading, empty and error states work. The empty state says "Create one to get started" but there is no control.
- **R2.4** WHEN a Member submits the Create board form, THE frontend SHALL call `POST /api/boards {name}`, show the new board in the list, and on 409 show "A board with that name already exists." while keeping the typed name. `[Plan]`
- **R2.5** WHEN a Member requests `GET /api/boards/{id}` for an owned board, THE backend SHALL return the board and its columns ordered by `position`, each column with its cards ordered by `order` ascending, excluding soft-deleted cards, in one response. `[Plan]` Assumption pending confirmation: D2. Current: the response contains only the board fields.
- **R2.6** WHEN a Member opens `/boards/{id}`, THE frontend SHALL render the columns and cards from that single response and SHALL show an error, not an empty board, if the request fails. `[Plan]` Current: the page calls two endpoints that do not exist (`GET /api/boards/{id}/columns` returns 405, `GET /api/v1/cards?column_id=` returns 404) and maps both to an empty board.
- **R2.7** IF the board does not exist or is owned by someone else, THEN THE backend SHALL return 404 `BOARD_NOT_FOUND` and SHALL NOT reveal which case applies. `[Done]`
- **R2.8** WHEN a Member submits a new `name` to `PATCH /api/boards/{id}`, THE backend SHALL apply the same rules as R2.1 and R2.2 and return 200 with the board. A change of letter case only SHALL NOT count as a conflict with the same board. `[BE]`
- **R2.9** THE frontend SHALL let a Member rename a board from the board page. `[Plan]`
- **R2.10** WHEN a Member confirms deletion, THE backend SHALL delete the board and its columns, cards and comments so that none of them can be read afterwards, and return 204. `[BE]` Assumption pending confirmation: D1. Current: `DELETE /api/boards/{id}` removes the row and the database cascades (`ON DELETE CASCADE` on `board_columns.board_id`, `cards.column_id`, `card_comments.card_id`). This is a hard delete. The default in D1 asks for soft delete, which needs `deleted_at` on boards and columns and a migration. See task B4.
- **R2.11** WHEN a Member chooses Delete board, THE frontend SHALL ask for confirmation naming the board and the number of cards that will be removed, and SHALL leave the board unchanged on cancel. `[Plan]`

### Requirement 3: Columns

**User story:** As a Member, I want to add, rename, reorder and delete columns, so that the board reflects my workflow.

Status: backend Done except R3.5. UI Planned.

#### Acceptance criteria

- **R3.1** WHEN a Member submits `name` (1 to 100 characters after trimming, not blank) to `POST /api/boards/{board_id}/columns`, THE backend SHALL create the column at the end of the board (`max(position) + 1`, or 0 if none) unless `position` (integer, 0 or more) is given, and return 201 with `id`, `board_id`, `name`, `position`, `created_at`, `updated_at`. `[BE]`
- **R3.2** AFTER every create, delete and reorder, THE backend SHALL renumber the board's column positions to 0, 1, 2, ... in order. `[BE]`
- **R3.3** WHEN a Member sends `PATCH /api/columns/{id}` with `name` and/or `position`, THE backend SHALL validate as in R3.1 and return 200 with the column. `[BE]`
- **R3.4** WHEN a Member sends `PATCH /api/boards/{board_id}/columns/reorder` with `ordered_ids` (a non-empty list of UUIDs), THE backend SHALL set each column's position to its index in the list and return 200 with all columns of the board ordered by position. IF an id is not a column of that board, THEN THE backend SHALL return 404 `COLUMN_NOT_FOUND` and change nothing. `[BE]` The backend accepts a partial list. The frontend SHALL always send the complete list.
- **R3.5** IF a column still contains cards that are not soft-deleted, THEN `DELETE /api/columns/{id}` SHALL return 409 `RESOURCE_CONFLICT` and change nothing. IF it contains no such cards, THEN THE backend SHALL delete it, renumber the remaining positions and return 204. `[Plan]` Assumption pending confirmation: D3. Current: the column is deleted and its cards are removed by the database cascade, with no check.
- **R3.6** THE frontend SHALL provide, on the board page: an "Add column" control, rename and delete controls on each column header, and move-left and move-right controls that call the reorder endpoint. `[Plan]` Current: `ColumnHeader` has optional `onRename` and `onColumnDelete` props that `BoardDetailView` does not pass, and nothing creates or reorders columns.
- **R3.7** WHEN a column delete is rejected with 409, THE frontend SHALL show "Move or delete this column's cards first." and keep the column. `[Plan]` Assumption pending confirmation: D3.
- **R3.8** THE backend SHALL return 404 `COLUMN_NOT_FOUND` (column routes) or `BOARD_NOT_FOUND` (board routes) when the caller does not own the board. `[Done]`

Column names are not unique within a board. This is current behaviour and is not changed.

### Requirement 4: Cards

**User story:** As a Member, I want to create, edit and delete cards, so that I can track work.

Status: backend Done except R4.5. UI Planned.

#### Acceptance criteria

- **R4.1** WHEN a Member submits `title` (1 to 255 characters after trimming, not blank) and optional `description` (up to 2000 characters, default empty) to `POST /api/v1/columns/{column_id}/cards`, THE backend SHALL create the card at the end of the column (`max(order) + 1.0`, or 0.0 if none), set `owner_id` to the caller and return 201 with `id`, `column_id`, `owner_id`, `title`, `description`, `order`, `priority`, `due_date`, `labels[]`, `assignee_ids[]`, `can_move`, `deleted_at`, `created_at`, `updated_at`. `[BE]`
- **R4.2** IF the title is blank or longer than 255 characters, or the description is longer than 2000 characters, THEN THE backend SHALL return 400 `VALIDATION_ERROR` and create nothing. `[Done]`
- **R4.3** WHEN a Member sends `PATCH /api/v1/cards/{id}` with `title`, `description`, `priority` (optional, `low|medium|high` or `null`), `due_date` (R15), or `label_ids` (R16), THE backend SHALL validate, update the card and return 200. `[BE]`
- **R4.4** THE backend SHALL accept `priority` (`low|medium|high` or `null`) in card requests. THE backend SHALL reject `status` with 400 `VALIDATION_ERROR` (the column is the status; cards have no `status` field). `[Done]` Current: `priority` is validated with `validate.OneOf(["low", "medium", "high"])` and stored. `status` is not a field on the card model.
- **R4.5** WHEN a Member deletes a card, THE backend SHALL set `deleted_at`, return 204, and exclude the card from board reads, comment access, search and analytics. `[Plan]` Assumption pending confirmation: D7. Current: `DELETE /api/v1/cards/{id}` removes the row (`db.session.delete`). The `deleted_at` column exists and only analytics filters on it.
- **R4.6** THE frontend SHALL provide, on the board page: an "Add card" control in each column (title required, description optional), a card detail dialog to edit title, description, priority, due date, labels, and assignees, and a Delete card control with confirmation. `[Plan]` Current: `AddCardForm` and `CardDetailModal` exist but are not mounted.
- **R4.7** IF a failed create or edit request returns an error, THEN THE frontend SHALL keep the typed values and show the error. `[Plan]`
- **R4.8** THE backend SHALL return 404 `CARD_NOT_FOUND` for a card whose board the caller does not own, and 404 `COLUMN_NOT_FOUND` when creating in a column the caller does not own. `[Done]`

Cards have `priority` (R4.4), `due_date` (R15), `labels[]` (R16), and `assignee_ids[]` (R18). The column acts as the status (D8, D9).

### Requirement 5: Move and reorder cards

**User story:** As a Member, I want to drag cards between and within columns, so that the board shows the real state of work.

Status: backend Done except R5.3. UI Planned (the hook exists, is unmounted and sends the wrong payload).

#### Acceptance criteria

- **R5.1** WHEN a Member sends `PATCH /api/v1/cards/{id}/position` with `column_id` (UUID) and `order` (number, 0 or more), THE backend SHALL place the card in that column with that `order` value and return 200 with the card. `[BE]`
- **R5.2** WHEN cards of a column are listed, THE backend SHALL order them by `order` ascending, then `created_at` ascending. `[BE]` (applies to the board read, R2.5)
- **R5.3** THE backend SHALL reject a move whose destination column belongs to a different board than the card's current board with 404 `COLUMN_NOT_FOUND`. `[Plan]` Current: only ownership of the destination column is checked, so a card can move to another board of the same owner.
- **R5.4** AFTER a move, THE backend SHALL renumber the `order` of the cards in the destination column and in the source column to 0.0, 1.0, 2.0, ... preserving the relative order. `[BE]` This is current behaviour. The visible order after a reload equals the dropped order. The midpoint trick (for example 1.5 between 1.0 and 2.0) therefore only decides where the card lands. It is not stored.
- **R5.5** WHEN a Member drops a card, THE frontend SHALL compute `order` as the midpoint of its new neighbours (neighbour order + 1.0 at the end, half of the first card's order at the start, 0.0 in an empty column), send `{column_id, order}`, and update the screen before the response. `[Plan]` Current: `useDragAndDrop` sends `{column_id, position}`, which the backend rejects with 400, and no component uses the hook.
- **R5.6** IF the move request fails, THEN THE frontend SHALL restore the previous position and show an error. `[Plan]`
- **R5.7** WHEN a Member logs in again and opens the board, THE app SHALL show every card in the column and position it had after the last successful move. `[Plan]` Depends on R2.5. See R9.1 for why a login is needed.
- **R5.8** THE frontend SHALL provide a way to move a card to another column without a pointer (a "Move to column" select in the card detail dialog). `[Plan]`
- **R5.9** AFTER a move request settles, THE frontend SHALL reload the board so that its local `order` values equal the stored ones. `[Plan]` The backend renumbers orders after every move (R5.4), so locally computed values go stale.
- **R5.10** IF the requested `order` equals the `order` of another card in the destination column, THEN THE backend SHALL place the moved card before that card. `[Plan]` Current: ties are broken by `created_at`, so a drop at the top of a column (new order 0, first card also 0 after renumbering) can land second.

### Requirement 6: Comments

**User story:** As a Member, I want to comment on a card, so that I can keep notes with the work.

Status: backend Done except R6.5. UI Planned.

#### Acceptance criteria

- **R6.1** WHEN a Member requests `GET /api/cards/{card_id}/comments` for a card on an owned board, THE backend SHALL return its comments oldest first with `id`, `card_id`, `author_id`, `body`, `created_at`, `updated_at`. `[BE]`
- **R6.2** WHEN a Member submits `body` (1 to 2000 characters after trimming, not blank) to `POST /api/cards/{card_id}/comments`, THE backend SHALL create the comment with the caller as author and return 201. `[BE]`
- **R6.3** WHEN the author sends `PATCH /api/comments/{id}` with `body`, THE backend SHALL validate as in R6.2 and return 200. `[BE]`
- **R6.4** WHEN the author sends `DELETE /api/comments/{id}`, THE backend SHALL delete the comment and return 204. `[BE]`
- **R6.5** IF a user who is not the author edits or deletes a comment, THEN THE backend SHALL return 404 `COMMENT_NOT_FOUND`, and THE backend SHALL check board ownership of the comment's card on edit and delete. `[Plan]` Current: 403 `COMMENT_ACCESS_DENIED`, which confirms the comment exists, and the board is not checked.
- **R6.6** IF the card or comment does not exist or is not accessible, THEN THE backend SHALL return 404 `CARD_NOT_FOUND` or `COMMENT_NOT_FOUND`. `[Done]` for card routes.
- **R6.7** THE frontend SHALL show, in the card detail dialog, the comment list (author shown as "You" when `author_id` equals the current user id), an add form, and edit and delete controls with confirmation on delete. `[Plan]` Current: `CardDetailModal` lists and adds comments but is not mounted, shows `author_id` as the author name, and has no edit or delete.

### Requirement 7: Profile

**User story:** As a Member, I want to see and change my profile, so that my name and timezone are correct.

Status: backend Done. UI sends a wrong payload.

#### Acceptance criteria

- **R7.1** WHEN a Member requests `GET /api/users/me`, THE backend SHALL return `id`, `email`, `name`, `timezone`, `role`, `is_active`, `created_at`, `updated_at`, without the password hash. `[BE]`
- **R7.2** WHEN a Member sends `PATCH /api/users/me` with `name` (up to 255 characters) and/or `timezone` (an IANA name, up to 64 characters), THE backend SHALL update only those fields and return 200. IF any other field (including `email`) is sent, THEN THE backend SHALL return 400. `[BE]`
- **R7.3** THE email SHALL be read-only in the MVP. THE frontend SHALL show it as plain text and SHALL NOT send it. `[Plan]` Assumption pending confirmation: D5. Current: `/profile` sends `{email, timezone}` and always gets 400.
- **R7.4** WHEN `/profile` opens, THE frontend SHALL load the profile from `GET /api/users/me` and SHALL send only `name` and `timezone` on save. `[Plan]`
- **R7.5** IF saving fails, THEN THE frontend SHALL show the error and keep the form values. `[Plan]`

Note (profile UX, Done): the profile page no longer shows the role. It disables Save and Reset while nothing differs from the saved values, warns on tab close or reload while there are unsaved changes (in-app navigation is not guarded), offers Reset, shows a name character counter and shows an initials avatar next to the name and email.

### Requirement 8: Search

**User story:** As a Member, I want to find cards on a board by text, so that I can locate work quickly.

Status: Planned. Assumption pending confirmation: D9, D13.

#### Acceptance criteria

- **R8.1** THE board page SHALL provide a search box with an accessible label. `[Plan]`
- **R8.2** WHEN a Member types a query of 1 to 100 characters, THE frontend SHALL show only the cards of the open board whose title or description contains the query, ignoring letter case. `[Plan]` Default (D13): the filter runs in the browser over the board data from R2.5. No new endpoint.
- **R8.3** WHEN the query is empty, THE frontend SHALL show all cards. `[Plan]`
- **R8.4** WHEN no card matches, THE frontend SHALL show a "No cards match" message. `[Plan]`
- **R8.5** THE search SHALL cover only the open board and SHALL NOT filter by priority, status, due date, label or assignee. `[Plan]` The board filter bar (R17) is a separate control and does not change this criterion. The cards have no such fields (verified in `backend/app/models/card.py`).
- **R8.6** WHEN the Member clears the box, THE frontend SHALL restore the full board. `[Plan]`

### Requirement 9: Session lifetime

**User story:** As a Member, I want to know how long I stay logged in, so that I am not surprised by a sign-in prompt.

#### Acceptance criteria

- **R9.1** THE frontend SHALL keep the access token in memory only. WHEN the page is reloaded or opened in a new tab, THE frontend SHALL treat the user as logged out and redirect to `/login`. `[Done]` Assumption pending confirmation: D4. This is a documented MVP limitation (V-009), not a goal.
- **R9.2** THE frontend SHALL NOT store the access token or any refresh token in `localStorage`, `sessionStorage` or `document.cookie`. `[Done]` (V-010 fixed; a search of `frontend/app`, `components`, `hooks` found none of those APIs)
- **R9.3** WHEN the access token expires (15 minutes), THE backend SHALL return 401 and THE frontend SHALL redirect to `/login`. `[Done]` for boards pages. Other pages: see R1.9.
- **R9.4** THE backend SHALL provide `POST /api/v1/auth/refresh` and `POST /api/v1/auth/logout` using a refresh token in an `HttpOnly`, `Secure`, `SameSite` cookie, with rotation, revocation and CSRF protection as `security.md` sections 3.3 and 7 require, so that a reload keeps the session and logout invalidates it. `[Plan]` Not in MVP. Needs an ADR (`docs/adr/0002-authentication-strategy.md`). Current: login returns `refresh_token` in the response body and stores its hash in `refresh_tokens`, but no route reads it.
- **R9.5** THE backend SHALL NOT return a `refresh_token` in the login response while no route accepts it. `[Plan]` Current: it is returned and ignored by the frontend.

### Requirement 10: API contract and errors

**User story:** As a developer, I want one consistent API contract, so that frontend and backend stay compatible.

#### Acceptance criteria

- **R10.1** THE backend SHALL wrap every success body as `{"data": ...}` and every error body as `{"error": {"code", "message", "details"}}`, including 404 and 405 errors from the framework (`HTTP_ERROR`) and unexpected errors (500 `INTERNAL_ERROR`). `[Done]`
- **R10.2** THE backend SHALL use 200, 201 and 204 for success, 400 for validation, 401 for missing or invalid credentials, 404 for missing or inaccessible resources, 409 for conflicts and 500 for unexpected failures. `[Done]` (no 403 except comments, see R6.5)
- **R10.3** THE backend SHALL NOT expose stack traces, SQL or internal paths in error bodies. `[Done]`
- **R10.4** THE backend SHALL expose every API route under `/api/v1`. `[Plan]` Assumption pending confirmation: D10. Current: cards are under `/api/v1`, everything else under `/api` (V-019). Task P1.
- **R10.5** THE backend SHALL register each blueprint once. `[Plan]` Current: `cards_bp`, `columns_bp` and `comments_bp` are each registered at two prefixes, which creates extra URLs such as `PATCH /api/v1/columns/{id}` that point to card handlers (see design.md section 5.3).
- **R10.6** THE frontend SHALL send every request through `lib/apiClient.ts`, which attaches the Bearer token and converts error bodies to `ApiError`. `[Plan]` Current: `AuthContext`, `profile/page.tsx`, `MyTasksList.tsx` and `useCardSearch.ts` call `fetch` directly (V-016).
- **R10.7** THE frontend SHALL NOT turn 404 or 405 responses into empty results. IF a required endpoint answers 404 or 405, THEN THE frontend SHALL show an error. `[Plan]` Current: `BoardDetailView`, `MyTasksList`, `useCardSearch` and `useNotifications` do.
- **R10.8** EVERY frontend request payload SHALL be covered by a contract test that loads the same sample through the backend Marshmallow schema and asserts the exact body on the frontend (`api-contracts.md` section 16.3). `[Plan]`
- **R10.9** THE JSON field names SHALL match the table in design.md section 5. Current names are `snake_case`. `api-contracts.md` section 5.2 asks for `camelCase`. This drift is V-020 and is not changed in the MVP. `[Done]` (as documented drift)
- **R10.10** THE backend SHALL document each implemented route in its Swagger docstring. `[Done]` for the routes in design.md. Not verified against a running instance.
- **R10.11** IF a path id is not a valid UUID, THEN THE backend SHALL return 404 and SHALL NOT raise an unexpected error. `[Plan]` Current: every route calls `uuid.UUID(value)` on the path string, so an invalid id raises `ValueError` and the generic handler returns 500 `INTERNAL_ERROR`. Read from the code, not executed.

### Requirement 11: Authorization and ownership

#### Acceptance criteria

- **R11.1** FOR every route that takes a board, column, card or comment id, THE backend SHALL resolve the resource through its board and compare `boards.owner_id` with the authenticated user before acting. `[Done]` for boards, columns, cards, comments (list and create) and analytics. See R6.5 for comment edit and delete.
- **R11.2** THE backend SHALL NOT read the owner from the request body or the token claims. `[Done]` (`owner_id` is taken from the authenticated user)
- **R11.3** WHEN a user supplies the id of another user's resource, THE backend SHALL answer as if the resource did not exist (404). `[Done]` except comment edit and delete (R6.5).
- **R11.4** THE backend SHALL NOT return password hashes, token hashes or other users' data in any response. `[Done]`
- **R11.5** THE frontend route guards SHALL be treated as user experience only. `[Done]`

### Requirement 12: Data persistence and integrity

#### Acceptance criteria

- **R12.1** THE backend SHALL store users, boards, columns, cards, comments, notifications and refresh tokens in PostgreSQL through SQLAlchemy, with schema changes in Alembic migrations. `[Done]` (one migration, `e75e73442f21`, in `backend/migrations/versions`)
- **R12.2** THE backend SHALL commit before returning a success response and SHALL roll back on failure. THE backend SHALL also create one notification for the board owner whenever a comment is posted on a card, including the owner's own comments. IF the board has other members, THE notification SHALL also be sent to those members. `[Done]`
- **R12.3** THE backend SHALL enforce non-negative `position` and `order` with check constraints and index `(board_id, position)` and `(column_id, order)`. `[Done]`
- **R12.4** WHEN a card is moved, THE backend SHALL update the destination and source ordering in one transaction. `[Done]`
- **R12.5** THE database SHALL enforce unique `(owner_id, lower(name))` on boards. `[Plan]` Current: service check only, so two concurrent creates can both pass.
- **R12.6** THE backend SHALL back up the database. `[Plan]` Not verified. Railway backup settings were not inspected.

### Requirement 13: Analytics (backend only)

Status: Backend only. No UI in the MVP (D11).

#### Acceptance criteria

- **R13.1** WHEN a Member requests `GET /api/analytics/boards/{board_id}/summary` for an owned board, THE backend SHALL return `board_id`, `total_cards` (cards that are not soft-deleted) and `completed_cards`. `[BE]` `completed_cards` is always 0 because cards have no completion state.
- **R13.2** IF the board is not owned by the caller, THEN THE backend SHALL return 404 `BOARD_NOT_FOUND`. `[Done]`

### Requirement 14: Notifications (backend only)

Status: Backend only. No UI and no producer in the MVP (D6).

#### Acceptance criteria

- **R14.1** WHEN a Member requests `GET /api/notifications` (`page`, `per_page` up to 100), THE backend SHALL return the caller's notifications, newest first, with `meta` `{page, per_page, total}`. `[BE]`
- **R14.2** WHEN a Member sends `PATCH /api/notifications/{id}/read`, THE backend SHALL set `is_read` and return 200, or 404 `NOTIFICATION_NOT_FOUND` for another user's notification. `[BE]`
- **R14.3** THE frontend SHALL NOT show `NotificationBell` in the MVP. `[Done]` (the component is not mounted)
- **R14.4** Nothing in the backend creates notifications. A search of `backend/app` found the `Notification` class only in its model file. `[Plan]` when notifications return (post-MVP).

### Requirement 15: Card due dates

**User story:** As a Member, I want to give a card a due date, so that I can see which work is late or about to be late.

Status: Planned (phase 1 of `.agents/tasks/kanban-features`). Design: `design.md` section 17.1. Decisions: section 12.2.

Terms: "UTC ISO" means `YYYY-MM-DDTHH:MM:SSZ`. "Local time" means the time zone of the user's browser.

#### Acceptance criteria

- **R15.1** WHEN a Member sends `due_date` (a string or `null`) to `POST /api/v1/columns/{column_id}/cards`, THE backend SHALL store it and return 201 with `due_date` in the card object. WHEN `due_date` is omitted, THE card SHALL have `due_date` `null`. `[Plan]`
- **R15.2** WHEN a Member sends `PATCH /api/v1/cards/{card_id}` with a valid `due_date` string, THE backend SHALL replace the stored value and return 200. WHEN the body omits `due_date`, THE stored value SHALL stay unchanged. `[Plan]`
- **R15.3** WHEN a Member sends `PATCH /api/v1/cards/{card_id}` with `"due_date": null`, THE backend SHALL clear the value and return 200 with `due_date` `null`. `[Plan]`
- **R15.4** IF `due_date` is not an ISO 8601 date-time string, THEN THE backend SHALL return 400 `VALIDATION_ERROR` with `details.due_date` and SHALL change nothing. `[Plan]`
- **R15.5** IF `due_date` has no UTC offset (naive, for example `2026-12-01T17:00:00`), THEN THE backend SHALL return 400 `VALIDATION_ERROR` with `details.due_date`. `[Plan]`
- **R15.6** IF the value, as sent or converted to UTC, has a year before 2000 or after 2100, THEN THE backend SHALL return 400 `VALIDATION_ERROR` with `details.due_date`. This SHALL also hold for extreme values whose conversion to UTC overflows (for example `9999-12-31T23:59:59-05:00` and `0001-01-01T00:00:00+05:00`): the response is 400, never 500. `[Plan]`
- **R15.7** THE backend SHALL store `due_date` as `timestamp with time zone` in UTC, discard fractional seconds, and serialise it as UTC ISO with the `Z` suffix. An input with another offset (for example `+07:00`) SHALL be converted to UTC. `[Plan]`
- **R15.8** EVERY card object returned by the backend SHALL contain `due_date` (a UTC ISO string or `null`): create, update, position, board read (route 6), card list (route 26) and the label replace route. `[Plan]`
- **R15.9** IF the card does not exist or its board is owned by another user, THEN `PATCH /api/v1/cards/{card_id}` SHALL return 404 `CARD_NOT_FOUND` and leave the card unchanged. A request without a valid token SHALL return 401. `[Plan]`
- **R15.10** THE card schemas SHALL keep rejecting unknown fields with 400. A PATCH that does not contain `due_date` SHALL NOT change it. A card move (route 16) SHALL keep the card's `due_date`. `[Plan]`
- **R15.11** THE database change SHALL be one nullable column `cards.due_date` with no default and no backfill, so that the code deployed before this change keeps working against the migrated database. THE migration SHALL have a working downgrade. `[Plan]`
- **R15.12** THE card dialog SHALL contain an input of type `datetime-local` with the accessible name "Due date", filled with the stored value in local time, a Save control and a "Remove due date" control. All three controls SHALL use `BaseButton` where they are buttons. `[Plan]`
- **R15.13** WHEN the Member saves, THE frontend SHALL send exactly `{"due_date": "<UTC ISO>"}` to `PATCH /api/v1/cards/{card_id}`. WHEN the Member chooses "Remove due date", THE frontend SHALL send exactly `{"due_date": null}`. THE Remove control SHALL be disabled while the card has no due date. `[Plan]`
- **R15.14** WHILE the input is empty or holds a date outside 2000..2100, THE Save control SHALL be disabled. IF the request fails, THEN THE frontend SHALL show the error with `role="alert"` and keep the typed value. `[Plan]`
- **R15.15** THE frontend SHALL compute the due state from the due date and a `now` argument: `none` (no due date), `overdue` (due before now), `soon` (due from now up to and including now + 24 hours), `upcoming` (later). A due date equal to `now` is `soon`. `[Plan]`
- **R15.16** THE board card and each row on `/my-tasks` SHALL show, for the states `overdue`, `soon` and `upcoming`, a `BaseBadge` with an icon and visible text ("Overdue", "Due soon" or "Due" followed by the date). THE state `none` SHALL show no badge. THE meaning SHALL NOT depend on colour alone. THE badge SHALL carry a `title` with the full local date and time. `[Plan]`
- **R15.17** THE frontend SHALL show dates in the browser's locale and time zone. THE profile `timezone` SHALL NOT be used to display due dates in this release. `[Plan]`
- **R15.18** THE board page SHALL recompute badge states with a fresh `now` every 60 seconds and after each board reload, without a page reload. `[Plan]`

### Requirement 16: Board labels

**User story:** As a Member, I want to define coloured labels on a board and attach them to cards, so that I can categorise work.

Status: Planned (phase 2). Design: `design.md` section 17.2. Decisions: section 12.2.

A label belongs to one board. A card can carry labels of its own board only. Colour keys: `blue`, `sky`, `graphite`, `silver`, `red`, `orange`, `green`, `purple`.

#### Acceptance criteria

- **R16.1** WHEN a Member requests `GET /api/boards/{board_id}/labels` for an owned board, THE backend SHALL return 200 with the labels ordered by lowercase name, then name, then id. IF the board is missing or owned by someone else, THEN THE backend SHALL return 404 `BOARD_NOT_FOUND`. `[Plan]`
- **R16.2** WHEN a Member sends `POST /api/boards/{board_id}/labels` with `name` (1 to 50 characters after trimming, not blank) and `color` (one of the 8 keys), THE backend SHALL create the label and return 201 with `id`, `board_id`, `name`, `color`, `created_at`, `updated_at`. `[Plan]`
- **R16.3** IF `name` or `color` is missing, blank, too long or not allowed, or the body has an unknown field, THEN THE backend SHALL return 400 `VALIDATION_ERROR` and create nothing. `[Plan]`
- **R16.4** IF the board already has a label with the same name compared case-insensitively, THEN THE backend SHALL return 409 `RESOURCE_CONFLICT`. Two different boards MAY have labels with the same name. `[Plan]`
- **R16.5** WHEN a Member sends `PATCH /api/labels/{label_id}` with `name` and/or `color`, THE backend SHALL validate as in R16.2 and R16.4 and return 200 with the label. A body with neither field SHALL return 400. A change of letter case only on the same label SHALL NOT conflict with itself. IF the label is missing or on a board owned by someone else, THEN THE backend SHALL return 404 `LABEL_NOT_FOUND`. `[Plan]`
- **R16.6** WHEN a Member sends `DELETE /api/labels/{label_id}`, THE backend SHALL hard-delete the label and its card associations and return 204. The cards themselves SHALL stay. Afterwards no card object SHALL contain that label. `[Plan]`
- **R16.7** WHEN a Member sends `PUT /api/v1/cards/{card_id}/labels` with `label_ids` (a list of UUIDs), THE backend SHALL replace the card's label set with exactly that list in one transaction and return 200 with the card object. An empty list SHALL remove all labels. `[Plan]`
- **R16.8** IF any id in `label_ids` is not a label of the same board as the card, THEN THE backend SHALL return 404 `LABEL_NOT_FOUND` and change nothing. The response SHALL be the same for a label of another board of the caller, a label of another user's board and an unknown id. `[Plan]`
- **R16.9** IF `label_ids` contains a duplicate id, more than 20 ids, a value that is not a UUID, or the body has an unknown field, THEN THE backend SHALL return 400 `VALIDATION_ERROR` and change nothing. `[Plan]`
- **R16.10** THE board read (route 6) SHALL contain `labels` (all labels of the board, order as R16.1). `[Plan]`
- **R16.11** EVERY card object returned by the backend SHALL contain `labels`, a list of `{id, name, color}` ordered as R16.1 (`[]` when none): create, update, position, board read, card list (route 26) and route 31. `[Plan]`
- **R16.12** THE board read and the card list SHALL load labels with a fixed number of queries, not one query per card. `[Plan]`
- **R16.13** EVERY new route SHALL answer 401 without a valid token and SHALL resolve the label, card or board through its board owner. A path id that is not a UUID SHALL return 404. `[Plan]`
- **R16.14** WHEN a board is deleted, THE database SHALL delete its labels and associations by cascade. A soft-deleted card SHALL keep its associations but SHALL NOT appear in any read. `[Plan]`
- **R16.15** THE database change SHALL add only new tables (`labels`, `card_labels`) and SHALL have a working downgrade. `[Plan]`
- **R16.16** EACH label on a board card SHALL show as a pill with the colour and the name text, never colour alone. A long name SHALL be truncated visually and the full name SHALL be in the `title` attribute. `[Plan]`
- **R16.17** THE card dialog SHALL have a "Labels" section with a button that opens a multi-select list (`role="listbox"`, `aria-multiselectable`, options with `aria-selected`). The list SHALL work with Arrow keys, Space and Enter, SHALL close on Escape without saving and return focus to the button, and SHALL send the chosen set once through an Apply control as exactly `{"label_ids": [...]}`. `[Plan]`
- **R16.18** THE card dialog SHALL let the Member create a label (name and colour), and rename, recolour and delete an existing label. THE delete SHALL ask for confirmation naming the label. A 409 SHALL show "A label with that name already exists." and keep the typed name. `[Plan]`
- **R16.19** THE colour choice SHALL show the colour name as text next to each swatch. THE frontend SHALL define the 8 colours in one file, `frontend/lib/labelColors.ts`, with no raw hex value in any component. EACH label background and text pair SHALL have a contrast ratio of at least 4.5:1, asserted by a test that computes it. `[Plan]`
- **R16.20** AFTER a label is created, renamed, recoloured or deleted, THE frontend SHALL reload the board so that every card shows the current label data. `[Plan]`

### Requirement 17: Board filter

**User story:** As a Member, I want to filter the cards of an open board by keyword, label and due date, so that I can focus on part of the work.

Status: Planned (phase 3). Design: `design.md` section 17.3. Decisions: section 12.2. Depends on R15 and R16. No new backend route.

#### Acceptance criteria

- **R17.1** THE board page SHALL show a filter bar between the board title and the columns, with a keyword input, a label multi-select, a due date select (Any, Overdue, Due within 24 hours, Due within 7 days, No due date) and a "Clear filters" button. Every control SHALL have an accessible name. `[Plan]`
- **R17.2** THE keyword filter SHALL keep a card WHEN the trimmed keyword occurs, ignoring letter case, in the card title or description. An empty or blank keyword SHALL keep every card. THE input SHALL accept at most 100 characters. `[Plan]`
- **R17.3** THE label filter SHALL keep a card WHEN it carries at least one of the selected labels (ANY). With no label selected, every card SHALL be kept. `[Plan]`
- **R17.4** THE due date filter SHALL use these rules with the current `now`: Overdue keeps `due < now`. Due within 24 hours keeps `now <= due <= now + 24 h`. Due within 7 days keeps `now <= due <= now + 7 days`. No due date keeps `due` null. Any keeps all. A card without a due date SHALL NOT match Overdue, 24 hours or 7 days. `[Plan]`
- **R17.5** THE three filters SHALL combine with AND. `[Plan]`
- **R17.6** NON-matching cards SHALL be hidden, not removed from the board data. WHILE any filter is active, EACH column header SHALL show "x of y", where x is the number of visible cards and y the number of cards in the column. WHILE no filter is active, no count SHALL be shown. `[Plan]`
- **R17.7** WHEN a filter is active, the board has at least one card and no card matches, THE frontend SHALL show "No cards match these filters." once, as a `role="status"` block between the filter bar and the columns. A column that has cards but none visible SHALL show no empty text. `[Plan]`
- **R17.8** WHEN the Member chooses "Clear filters", THE frontend SHALL reset all three filters and remove them from the URL. THE control SHALL be disabled while no filter is active. `[Plan]`
- **R17.9** THE filter state SHALL be kept in the URL query `q`, `labels` (comma-separated label ids) and `due` (`overdue`, `24h`, `7d` or `none`), so that a reload shows the same filters. A value that is invalid (unknown `due`, a label id that is not a label of this board) SHALL be ignored without an error, and a `q` longer than 100 characters SHALL be cut to its first 100 characters. THE URL SHALL NOT be rewritten because of an ignored value: only a user action changes it, so a reload before the board has loaded keeps `labels` intact. `[Plan]`
- **R17.10** WHILE any filter is active, THE frontend SHALL turn drag and drop off and SHALL show the text "Drag and drop is off while filters are active. Clear filters to move cards." in the filter bar. The "Move to column" control in the card dialog SHALL keep working and SHALL compute the new `order` from the complete column. `[Plan]`
- **R17.11** WHEN the Member presses the `f` key without modifier keys while focus is not in an input, textarea, select or editable element and no dialog is open, THE frontend SHALL focus the keyword input (and open the filter bar on a narrow screen) and SHALL NOT type the character. THE input SHALL expose `aria-keyshortcuts="f"` and the hint SHALL be visible. `[Plan]`
- **R17.12** ON screens narrower than the `md` breakpoint, THE filter bar SHALL be collapsible with a button that has `aria-expanded` and `aria-controls`, and the button SHALL show the number of active filters. AT 375 px the page SHALL NOT scroll horizontally with the bar open. `[Plan]`
- **R17.13** THE board filter SHALL NOT call the backend. THE existing global `SearchBar` SHALL stay unchanged. `[Plan]`
- **R17.14** THE filter functions SHALL be pure, take `now` as an argument and SHALL NOT change their input. `[Plan]`
- **R17.15** WHEN a filter is active, THE filter bar SHALL contain a status text "N of M cards shown" (`role="status"`, polite). It SHALL be updated only after typing has paused for 300 ms. `[Plan]`

### Requirement 18: Board members and card assignees

**User story:** As a board owner, I want to invite other registered users to my board and assign cards to them, so that we can collaborate.

Status: backend Done. UI: `BoardMembersPanel` and assignee select in card dialog Done.

#### Acceptance criteria

- **R18.1** WHEN a board owner sends `POST /api/boards/{board_id}/members` with `email` (a registered user), THE backend SHALL add that user to `board_members` with role `member` and return 201 with `{user_id, role}`. IF the email is not a registered user, THE backend SHALL return 404 `BOARD_NOT_FOUND`. IF the user is already a member, THE backend SHALL return 409 `RESOURCE_CONFLICT`. `[Done]`
- **R18.2** WHEN a board member (owner or member) requests `GET /api/boards/{board_id}/members`, THE backend SHALL return 200 with a list of `{user_id, email, name, role}` ordered by `created_at`. IF the board does not exist or the caller is not a member, THE backend SHALL return 404 `BOARD_NOT_FOUND`. `[Done]`
- **R18.3** WHEN a board owner sends `DELETE /api/boards/{board_id}/members/{member_user_id}`, THE backend SHALL remove that user from `board_members` and return 204. IF the user is the owner, THE backend SHALL return 409 `RESOURCE_CONFLICT` (the owner cannot be removed). IF the user is not a member, THE backend SHALL return 404 `BOARD_NOT_FOUND`. `[Done]`
- **R18.4** WHEN a board member sends `PATCH /api/v1/cards/{card_id}/assignees` with `user_ids` (a list of UUIDs, max 10), THE backend SHALL replace the card's assignee set with exactly that list in one transaction and return 200 with the card object including `assignee_ids`. IF any id in `user_ids` is not a member of the card's board, THE backend SHALL return 404 `CARD_NOT_FOUND` and change nothing. IF `user_ids` contains more than 10 ids, THE backend SHALL return 400 `VALIDATION_ERROR`. `[Done]`
- **R18.5** EVERY card object returned by the backend SHALL contain `assignee_ids` (a list of UUIDs, `[]` when none): create, update, position, board read, card list. `[Done]`
- **R18.6** THE backend SHALL create one notification for the board owner whenever a comment is posted on a card, including the owner's own comments. IF the board has other members, the notification SHALL also be sent to those members. `[Done]`
- **R18.7** THE board page SHALL show a `BoardMembersPanel` with: a list of current members (avatar, name, email, role badge), an "Invite" button that opens a dialog with an email input, and a "Remove" button on each member row (disabled for the owner). `[Done]`
- **R18.8** THE card detail dialog SHALL show an "Assignees" section with a multi-select list of board members. The list SHALL work with Arrow keys, Space and Enter, SHALL close on Escape without saving, and SHALL send the chosen set once through an Apply control as exactly `{"user_ids": [...]}`. `[Done]`
- **R18.9** AFTER a member is invited or removed, THE frontend SHALL reload the board so that the member list and card assignees reflect the current state. `[Done]`
- **R18.10** THE database change SHALL add two new tables (`board_members`, `card_assignees`) and SHALL have a working downgrade. `[Done]`

## 6. Non-functional requirements

### N1 Security

- **N1.1** THE backend SHALL answer cross-origin requests only for origins in `CORS_ALLOWED_ORIGINS`, without wildcards in production, with credentials off. `[Done]` (tests in `backend/tests/api/test_cors_health.py`)
- **N1.2** THE backend SHALL refuse to start in production when `SECRET_KEY`, `JWT_SECRET_KEY`, `DATABASE_URL` or `CORS_ALLOWED_ORIGINS` is missing or blank. `[Done]` (tests in `backend/tests/unit/test_config.py`)
- **N1.3** THE backend SHALL rate-limit login, register and other abuse-prone routes using storage shared by all instances. `[Plan]` Not implemented (V-011). Needs a shared store such as Redis, because Railway runs several gunicorn workers.
- **N1.4** THE backend and frontend SHALL send `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, a Content-Security-Policy with `frame-ancestors`, and `Strict-Transport-Security` over HTTPS. `[Plan]` None is set today. A search for these headers in `backend/app` found no match. `frontend/next.config.ts` was not checked for headers.
- **N1.5** THE backend SHALL set a maximum request body size. `[Plan]` No `MAX_CONTENT_LENGTH` found.
- **N1.6** THE backend SHALL NOT serve the Swagger UI and `apispec` in production without authentication. `[Plan]` flasgger registers them by default and no setting disables them. Not probed on the production host.
- **N1.7** THE frontend SHALL render user text (board names, titles, descriptions, comments) as text and SHALL NOT use `dangerouslySetInnerHTML`. `[Done]` (none found in `frontend/app`, `components`, `hooks`)
- **N1.8** THE backend SHALL hash passwords with Argon2id or bcrypt. `[Plan]` V-013. Current: Werkzeug default.
- **N1.9** WHEN cookies are introduced (R9.4), THE backend SHALL add CSRF protection to state-changing routes. `[Plan]`
- **N1.10** THE backend SHALL log failed logins and authorization failures with request id, user id when known, endpoint and status, and never passwords or tokens. `[Plan]` Current: only `AppException` is logged, with type, code and status, and there is no request id.

### N2 Accessibility

- **N2.1** EVERY interactive control SHALL have an accessible name and be reachable and operable by keyboard. `[Plan]` Existing components set `aria-label` and roles in places. No audit has been run.
- **N2.2** THE card detail dialog SHALL trap focus, close on Escape, and return focus to the card that opened it. `[Plan]` `BaseModal` exists. Behaviour not verified.
- **N2.3** Form errors SHALL be announced (`role="alert"`) and tied to their field. `[Plan]` Login and register already use `role="alert"` as read. The other forms do not exist yet.
- **N2.4** EVERY drag-and-drop action SHALL have a non-pointer alternative (R5.8). `[Plan]`

### N3 Responsive layout

- **N3.1** THE UI SHALL be usable at 375 px, 768 px and 1280 px widths. On narrow screens the columns SHALL scroll horizontally. `[Plan]` The board strip already scrolls horizontally (`overflow-x-auto`). No viewport test exists.

### N4 Performance basics

- **N4.1** THE board read (R2.5) SHALL use a fixed number of queries (board, columns, cards, plus the label queries from R16.12), not one query per column or card. `[Plan]`
- **N4.2** THE backend SHOULD answer board read, card move and comment calls in under 500 ms at the 95th percentile for a board of up to 10 columns and 200 cards. `[Plan]` No measurement exists. The target is an assumption.
- **N4.3** Boards and cards lists have no pagination in the MVP. Notifications do. `[Done]` (documented limit)

### N5 Deployment

- **N5.1** THE backend SHALL run on Railway (root `backend`, gunicorn from `backend/Procfile`, pre-deploy `flask db upgrade`, health check `/api/health`). `[Done]` per `docs/deployment-railway.md`.
- **N5.2** THE frontend SHALL run on Vercel (root `frontend`) with `NEXT_PUBLIC_API_BASE_URL` set to the backend origin, https, no path. `[Done]` per `docs/deployment-vercel.md`. The build fails on Vercel if the variable is missing or has a path.
- **N5.3** THE backend variables SHALL be `APP_ENV`, `SECRET_KEY`, `JWT_SECRET_KEY`, `DATABASE_URL`, `CORS_ALLOWED_ORIGINS`, `FLASK_APP`, optional `WEB_CONCURRENCY`. THE frontend variables SHALL be `NEXT_PUBLIC_API_BASE_URL` and optional `API_BASE_URL`. `.env.example` SHALL list names with placeholder values only. `[Done]`
- **N5.4** `/api/health` SHALL return 200 with `{"data": {"status", "db"}}` and no secrets. `[Done]` It returns 200 even when `db` is `error`.

### N6 Testing

- **N6.1** THE backend SHALL have Pytest unit tests for services and API tests for every route, covering success, validation, 401 and cross-user access. `[Plan]` Existing: auth service, auth routes, card move service, comments routes, CORS and health, config. No tests for boards, columns, users, notifications or analytics routes.
- **N6.2** THE frontend SHALL have Jest and React Testing Library tests for each mounted component and each API payload (R10.8). `[Plan]` Existing: `BoardCard`, `BoardDetailView`, `BoardsGrid`, `CommentList`, home page, `useRequireAuth`, `AuthContext`.
- **N6.3** THE e2e suite SHALL use Playwright with Page Objects, no `waitForTimeout`, and cover register, login, create board, add columns and cards, move a card, comment, log out, and the board state after logging in again. `[Plan]` Existing: `e2e/tests/auth.spec.ts` and `e2e/tests/kanban-journey.spec.ts`. The second expects controls that do not exist and a reload that keeps the session, which R9.1 rules out. No Page Objects yet (V-026).
- **N6.4** THE project SHALL report only test results that were actually produced. `[Done]`

## 7. Technology stack (locked)

- Frontend: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, `react-hot-toast`. Tests: Jest, Testing Library.
- Backend: Python, Flask 3, Marshmallow 4, SQLAlchemy 2, Flask-Migrate (Alembic), PyJWT, flask-cors, flasgger, gunicorn. Tests: Pytest.
- Database: PostgreSQL.
- End-to-end: Playwright.
- Hosting: Vercel (frontend), Railway (backend and PostgreSQL).

`Flask-JWT-Extended` is pinned in `backend/requirements.txt` but the code uses PyJWT directly. Not changed here.

## 8. Out of scope for the MVP

- Board sharing with external users (only registered accounts can be invited).
- Admin features.
- Task attributes: status (column is the status), sorting. Priority and assignee are in scope (R4.4, R18). Due dates, labels and the board filter are in scope through R15 to R17. Overdue notifications, reminders, recurring dates, label sharing across boards and server-side filtering stay out of scope.
- "My Tasks" page (D8).
- Activity log (D12).
- Notifications in the UI and their producers (D6).
- Analytics in the UI (D11).
- Email change (D5).
- Server-side session refresh and logout (R9.4).
- Real-time updates, attachments, integrations.

Note: Board members and assignees are in scope. A board can have multiple `board_members` (role `owner` or `member`), and cards can have multiple assignees via `card_assignees`. The owner can invite registered accounts by email, list members, and remove members. Members can modify or move their own cards or cards assigned to them.

## 9. Assumptions

- Each board has one owner.
- The column is the card's status.
- Column and card order is per column and survives reload.
- `Task -> Card` and `Project -> Board` (Q1).
- The 15-minute access token lifetime and 7-day refresh token lifetime are current code values, not requirements.

## 10. Testing requirements

| Level     | Scope                                                                                                              | Tool                                                   |
| --------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| Unit      | Services: boards, columns, cards, comments, users, auth. Payload helpers.                                          | Pytest, Jest                                           |
| API       | Every route in design.md section 5: success, validation, 401, cross-user 404.                                      | Pytest, Flask test client                              |
| Security  | Unauthenticated access, IDOR on every nested resource, unknown fields, password hash never returned, error bodies. | Pytest                                                 |
| Contract  | Each frontend payload against its Marshmallow schema.                                                              | Pytest + Jest sharing `docs/api/contract-samples.json` |
| Component | Board page, columns, add forms, card dialog, comments, profile, header.                                            | Jest + Testing Library                                 |
| E2E       | Critical Kanban journey (traceability table in design.md section 13).                                              | Playwright                                             |

## 11. Definition of done

A requirement counts as Done when its criteria are implemented, its tests from section 10 pass and were run, authorization and validation are covered by tests, loading, empty and error states exist in the UI, and design.md and tasks.md reference it.

## 12. Open decisions

The product owner has not answered these. The default was chosen so work can start. Each criterion that depends on one is marked `Assumption pending confirmation: Dn`. Change a default here, then update the listed requirements, design.md and tasks.md.

| ID        | Question                                                   | Decision (default chosen)                                                                                                                                                                                                            | Alternatives                                                                          | Impact if changed                                                                                            |
| --------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| D1 (Q2)   | What happens to columns and cards when a board is deleted? | Delete them with the board, after a confirmation in the UI. Observable result: nothing from the board can be read afterwards. Current code: hard delete by database cascade. The default asks for soft delete consistent with cards. | Keep cascade as hard delete (no migration). Block deletion while the board has cards. | R2.10, R2.11, task B4. Soft delete adds `deleted_at` to `boards` and `board_columns` and filters every read. |
| D2 (Q4)   | How does the UI read a board?                              | `GET /api/boards/{id}` returns board, columns and cards in one response.                                                                                                                                                             | Separate `GET .../columns` and `GET .../cards` list endpoints.                        | R2.5, R2.6, R8.2, task B1, F4.                                                                               |
| D3 (Q5)   | Deleting a column that has cards.                          | Reject with 409 until the cards are moved or deleted.                                                                                                                                                                                | Move cards to another column. Delete the cards with the column (current).             | R3.5, R3.7, task B2, F5.                                                                                     |
| D4 (Q6)   | Session after reload.                                      | Token in memory. A reload requires login again. Refresh and logout with HttpOnly cookie is a separate planned requirement.                                                                                                           | Build refresh and logout now (task P2).                                               | R9.1, R5.7, e2e journey, task P2.                                                                            |
| D5 (Q7)   | Profile fields.                                            | Name and timezone editable. Email read-only.                                                                                                                                                                                         | Allow email change (needs uniqueness check and schema change).                        | R7.2, R7.3, task F10.                                                                                        |
| D6 (Q8)   | Notifications.                                             | Out of MVP. Backend routes kept. No UI.                                                                                                                                                                                              | Build producers and the bell.                                                         | R14, task N1.                                                                                                |
| D7 (Q9)   | Card delete.                                               | Soft delete (`deleted_at`). Current code hard-deletes, so this is a change.                                                                                                                                                          | Keep hard delete and drop `deleted_at` (needs migration).                             | R4.5, R13.1, task B3.                                                                                        |
| D8 (Q10)  | "My Tasks" and assignee.                                   | Out of MVP. The `/my-tasks` page is removed (task F12).                                                                                                                                                                              | Add an assignee column and a list endpoint.                                           | Section 8, task F12.                                                                                         |
| D9 (Q11)  | Search scope.                                              | Case-insensitive match on title and description within one board. No priority, status, due date, labels. The model has none of these (verified in `models/card.py`).                                                                 | Add those columns with a migration.                                                   | R8, R4.4, task B8, F11.                                                                                      |
| D10 (Q12) | API prefix.                                                | Target `/api/v1` for every route. The current split is documented as is.                                                                                                                                                             | Keep the split.                                                                       | R10.4, R10.5, task P1.                                                                                       |
| D11       | Analytics and comments.                                    | Analytics backend only. Comments in scope for list, add, edit and delete by author.                                                                                                                                                  | Build an analytics widget.                                                            | R13, R6.                                                                                                     |
| D12       | Activity log.                                              | Out of MVP.                                                                                                                                                                                                                          | Build an activity model and list.                                                     | Section 8.                                                                                                   |
| D13       | Where search runs.                                         | In the browser over the loaded board (no new endpoint). Added by this rewrite because D2 loads every card of the board.                                                                                                              | `GET /api/v1/cards?board_id=&search=` on the backend.                                 | R8.2, task F11.                                                                                              |

### 12.1 Decisions changed during the Kanban UI work (uncommitted)

The project assessment requires a notification bell with an unread count, a working My Tasks page and a search that finds cards. Three defaults above did not allow that, so they were changed. The table rows are kept as the original record. Where a criterion in section 5 still describes the old default, this note wins.

- **D6 changed.** Notifications are in scope. The backend creates one notification for the board owner whenever a comment is posted on one of their cards, including the owner's own comments, because a board has exactly one owner. `GET /api/notifications` adds `meta.unread_count`. The bell in the header shows that count, and clicking a notification marks it read. The bell refreshes every 30 seconds, so the count can lag by up to 30 seconds.
- **D8 changed.** `/my-tasks` is kept, not removed. It lists the cards the caller created (`GET /api/v1/cards?mine=true`), grouped by board, with links to each board. Cards show their priority (`low|medium|high`) and due date when set.
- **D13 changed.** Search runs on the backend: `GET /api/v1/cards?search=&board_id=` matches title and description, case-insensitive, at most 100 characters, only over boards the caller owns. The board page uses it with `board_id` set.
- D2, D3 and D7 were implemented with the default shown in the table. D1 is unchanged: board delete is still a hard database cascade and there is no board delete UI.

### 12.2 Decisions for due dates, labels and the board filter (2026-11-24)

The product owner chose the three features and their order ("mulai dari tanggal jatuh tempo, lalu label dan filter"). The rows D14 to D21 resolve the points the brief left open. They overrule section 8 and D9 where those say "no due date, labels".

| ID  | Question                                | Decision                                                                                                                                                            | Why                                                                                                                                                                       |
| --- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D14 | Drag and drop while a filter is active  | Turn drag and drop off and say so in the filter bar (R17.10). The "Move to column" control stays and uses the complete column.                                      | A drop between two visible cards may hide cards between them. Computing `order` from visible neighbours is wrong. Off is the safer option and needs no new ordering code. |
| D15 | Label filter: ANY or ALL                | ANY. A card matches when it has at least one selected label (R17.3).                                                                                                | Matches Trello's default for a label filter and gives a non-empty result more often. Other filters narrow with AND.                                                       |
| D16 | Time zone for due date display          | The browser's locale and time zone. The profile `timezone` is not used (R15.17). Storage and API are UTC.                                                           | The profile timezone is free text with no consumer today. The input `datetime-local` already works in browser time, so both directions stay consistent.                   |
| D17 | Duplicate ids in `label_ids`            | Reject with 400 (R16.9).                                                                                                                                            | The client builds the list from a set. A duplicate signals a bug. Silent de-duplication hides it.                                                                         |
| D18 | 404 or 403 for resources of other users | 404 for every new route, with the same body as a missing resource (R16.8, R16.13). No new 403.                                                                      | Follows R11.3 and `security.md` section 4.5 (do not disclose existence). The comment 403 stays a known deviation (R6.5).                                                  |
| D19 | Migrations                              | Two migrations, one per phase: phase 1 adds `cards.due_date`, phase 2 adds `labels` and `card_labels`. Phase 3 has none. Justification in `design.md` section 17.4. | Phase 1 can ship alone and be rolled back alone. The label migration is larger and carries the risk. A combined migration would tie due dates to it.                      |
| D20 | Due date serialisation                  | UTC with `Z` and second precision, for this field only. Existing timestamps keep `+00:00`.                                                                          | `api-contracts.md` asks for `Z`. Changing existing fields is a breaking change and out of scope.                                                                          |
| D21 | Labels per board                        | No limit on the number of labels per board in this release. Open risk recorded in `design.md` section 17.5. The limit of 20 labels per card stays.                  | The brief fixes only the per-card limit. A board limit would be a new product rule and needs the product owner.                                                           |
