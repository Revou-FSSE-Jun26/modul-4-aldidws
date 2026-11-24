# API contract notes

This file lists the endpoints that were added or changed for the Kanban UI. The full route table is in `specs/design.md` section 5.2 (with the changes in 5.2.1), and the live Swagger UI is served by Flask at `/apidocs/`.

`frontend-request-payloads.json` in this folder holds one sample body for every request the frontend sends. Two tests read it so the frontend and the Marshmallow schemas cannot drift apart: `backend/tests/contract/test_frontend_payloads.py` and `frontend/lib/services/__tests__/contract.test.ts`.

## Conventions

- Auth: `Authorization: Bearer <access_token>` on every route below. A missing or invalid token returns 401 `UNAUTHORIZED`.
- Success: `{"data": ...}`; lists may add `meta`. Errors: `{"error": {"code", "message", "details"}}`.
- Resources on a board the caller does not own return 404 (existence is not disclosed).
- Field names are snake_case as serialized today (V-020 records the gap to `api-contracts.md`).

## New or changed endpoints

| Method | Path | Params / body | Success | Errors |
| --- | --- | --- | --- | --- |
| GET | `/api/boards/{board_id}` (changed) | none | 200 board plus `columns[]` ordered by `position`, each with `cards[]` ordered by `order` then `created_at`; soft-deleted cards excluded | 404 `BOARD_NOT_FOUND` |
| DELETE | `/api/columns/{column_id}` (changed) | none | 204 when the column has no live cards | 409 `RESOURCE_CONFLICT` while it has live cards; 404 `COLUMN_NOT_FOUND` |
| DELETE | `/api/v1/cards/{card_id}` (changed) | none | 204; sets `deleted_at` (soft delete). The card disappears from the board read, the card list, comments, move and analytics | 404 `CARD_NOT_FOUND`, also on a repeat delete |
| PATCH | `/api/v1/cards/{card_id}/position` (changed) | `{column_id: UUID, order: number >= 0}` | 200 card. On an `order` tie the moved card goes first; orders are then renumbered, so reload the board | 400 `VALIDATION_ERROR`; 404 `CARD_NOT_FOUND` or `COLUMN_NOT_FOUND` |
| GET | `/api/v1/cards` (new) | query `search` (1..100 chars, case-insensitive over title and description, `%` and `_` literal), `board_id` (UUID), `mine` (boolean: only cards the caller created), `page` (>= 1, default 1), `per_page` (1..100, default 20). Unknown or repeated keys are rejected | 200 `data` = card objects plus `board_id`, `board_name`, `column_name`, ordered by board name, column position, `order`, id; `meta` = `{page, per_page, total}`. Only boards the caller owns | 400 `VALIDATION_ERROR` |
| POST | `/api/cards/{card_id}/comments` (changed) | `{body: 1..2000 chars, not blank}` | 201 comment (now with `author_name`). Side effect: one notification for the board owner, saved in the same commit | 400 `VALIDATION_ERROR`; 404 `CARD_NOT_FOUND` |
| GET | `/api/cards/{card_id}/comments` (changed) | none | 200 comments oldest first, each with `author_name` | 404 `CARD_NOT_FOUND` |
| PATCH | `/api/comments/{comment_id}` (unchanged route, now tested exactly) | `{body}` | 200 comment | 400; 403 `COMMENT_ACCESS_DENIED` for another user's comment; 404 `COMMENT_NOT_FOUND` |
| DELETE | `/api/comments/{comment_id}` (unchanged route, now tested exactly) | none | 204 | 403 `COMMENT_ACCESS_DENIED`; 404 `COMMENT_NOT_FOUND` |
| GET | `/api/notifications` (changed) | query `page`, `per_page` (capped at 100) | 200 `data` = notifications (`id`, `user_id`, `title`, `body`, `is_read`, `created_at`, `updated_at`); `meta` = `{page, per_page, total, unread_count}` | none beyond 401 |
| PATCH | `/api/notifications/{id}/read` (unchanged, now used by the bell) | none | 200 notification with `is_read: true` | 404 when the notification is not the caller's |
| POST | `/api/auth/login` (changed, public) | `{email, password}` | 200 `{access_token, refresh_token, user: {id, email, name, role, timezone}}`; `name` is new. The frontend ignores `refresh_token` | 400; 401 `INVALID_CREDENTIALS` |

`author_name` is the author's `name`, or the part of the email before `@` when the name is empty.

## Known gaps

- Because `cards_bp` is registered under two prefixes, `GET /api/v1/columns` answers the same as `GET /api/v1/cards`. No client uses it (`specs/design.md` 5.3).
- An invalid UUID in the path of the older routes still returns 500 (task B11).
- `page` and `per_page` on `/api/notifications` are not validated; a non-integer falls back to the default.
- Comment edit and delete do not check board ownership, only authorship.
