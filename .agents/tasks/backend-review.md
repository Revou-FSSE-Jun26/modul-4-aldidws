# Backend changes: card.order float, soft-delete, notifications, analytics, users

Two commits (`e5b3fe6`, `3a62de8`) introduce the Card model rename (`position → order` as Float), `deleted_at` soft-delete, three new blueprints (notifications, analytics, users), a health endpoint, and a database migration for all new schema. A follow-up fix commit addressed an earlier review's findings on pagination, `card_to_dict`, exception placement, analytics semantics, and URL-prefix comment.

**Watch for:**

- Analytics `total_cards` counts soft-deleted cards — confirmed gap.
- `BoardColumn` docstring says "integer" but the column is `Float` — confirmed stale doc.
- `update_me` service silently writes `timezone` to users, but the `UpdateUserSchema` accepts it without any IANA format validation.

**Verdict**: NEEDS_CHANGES

---

## High-level view

The Card model rename from `position` (Integer) to `order` (Float) is complete and consistent across model, service, schema, routes, conftest fixtures, and migration. The double-quoted `"order"` in the check constraint and the composite index on `(column_id, order)` are correct for the SQL reserved word.

`BoardColumn.position` is correctly carried forward as `Float`, matching the migration, but the class docstring still describes it as "Zero-based integer determining display order." This creates a misleading contract for anyone reading the model.

The three new blueprints follow the thin-route / service-layer pattern and use `@token_required` from `app.blueprints.auth.decorators` throughout — no `@jwt_required()` appears anywhere. All success responses use `{"data": ...}` and error responses use `{"error": {...}}`.

The analytics service uses `func.count` with a join to count cards per board in two queries (one for the board ownership check, one for the count), avoiding N+1. However the count query does not filter `deleted_at IS NULL`, so soft-deleted cards inflate `total_cards`. The `completed_cards = 0` stub is explicitly documented and not a gap.

Notifications pagination applies the `min(per_page, 100)` cap in both the route and the service (the service has its own `per_page = min(per_page, 100)` guard). The double cap is harmless redundancy rather than a bug, but it represents dead logic in the service layer.

The `users/` blueprint exposes `GET /me` and `PATCH /me`. `user_to_dict` delegates to `User.to_dict()`, which explicitly excludes `password_hash` — no leak path. The `update_me` service accepts `timezone` from the schema without validating that the value is a recognizable IANA timezone string; a client can write arbitrary garbage into that column.

The `app/models/__init__.py` imports `Notification` correctly. The `conftest.py` `tables` fixture imports `Notification` and the `make_card` / `seeded` fixtures use `order` with no residual `position` reference.

The migration is a single `down_revision = None` initial migration covering the full schema from scratch, which matches the project's current state (no prior migration history). The `cards` table in the migration includes `deleted_at`, the `"order"` check constraint with double quotes, and the composite index on `(column_id, order)`.

---

<details>
<summary>Issues (3)</summary>

1. **Analytics counts soft-deleted cards** — `board_summary` counts all cards joining through `BoardColumn.board_id == board_id` without filtering `Card.deleted_at IS NULL`. Soft-deleted cards inflate `total_cards`. Add `.where(Card.deleted_at == None)` to the count query.

2. **BoardColumn docstring says "integer"** — The class docstring for `position` reads "Zero-based integer determining display order" but the column is `Float`. Update the docstring to reflect the Float type, consistent with the model's actual `Mapped[float]` declaration and the migration's `sa.Float()`.

3. **No IANA validation on timezone field** — `UpdateUserSchema` accepts any string up to 64 characters for `timezone`, and `update_me` writes it directly to the database. A client can write `"garbage"` into this column without an error. Add a validation step (e.g. check against `zoneinfo.available_timezones()` or use `pytz`) or document that the field is intentionally free-form and validated at the presentation layer.

</details>

<details>
<summary>Details</summary>

## BoardColumn docstring vs. Float type

The class docstring reads "Zero-based **integer** determining display order" but the column is `Mapped[float] = mapped_column(Float, ...)`. The functional behavior is correct; the documentation misleads any reader relying on the docstring to understand the column's range semantics.

## Analytics `deleted_at` filter missing

`board_summary` counts cards with a single `func.count(Card.id)` query joined through `Card.column → BoardColumn.board_id`. No `Card.deleted_at == None` filter is applied. Soft-deleted cards still have a valid `column_id` and are therefore included in the aggregate. The model docstring describes `deleted_at` as signaling removal, so `total_cards` should represent active cards only. The fix is adding `.where(Card.deleted_at == None)` to the count query.

## Notifications pagination double-cap

The route enforces `per_page = min(request.args.get("per_page", 20, type=int), 100)` before calling the service. The service applies the same `per_page = min(per_page, 100)` guard again. The service guard is unreachable. This isn't a correctness bug but it is dead code — pick one place to own the cap and remove the other.

## `update_me` timezone field validation

`UpdateUserSchema` accepts any string up to 64 characters for `timezone`, and `update_me` writes it directly to `User.timezone`. The model docstring states the field is "Used when evaluating due-date comparisons in the user's local day", meaning the value will eventually be passed to a timezone-aware datetime operation. Storing `"not/a/timezone"` now will produce a runtime error later at the consumption site, with no feedback to the caller at write time. Validate against `zoneinfo.available_timezones()` in the schema or service, or document the field as intentionally free-form if validation is deferred to the presentation layer.

</details>

---

## File map

<details>
<summary>Changed files</summary>

| File                                       | Change                                                                                                 |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `app/models/card.py`                       | `position → order` as Float; `deleted_at` added; check constraint quoted for `order`                   |
| `app/models/board_column.py`               | `position` changed from Integer to Float; docstring still says "integer"                               |
| `app/models/user.py`                       | `name` column added (`String(255)`, nullable)                                                          |
| `app/models/notification.py`               | New model: `id`, `user_id`, `title`, `body`, `is_read`, timestamps                                     |
| `app/models/__init__.py`                   | Added `Notification` import                                                                            |
| `app/blueprints/cards/schema.py`           | New file: `CreateCardSchema`, `UpdateCardSchema`, `CardPositionSchema`, `card_to_dict` using `order`   |
| `app/blueprints/cards/service.py`          | New file: `create_card`, `update_card`, `delete_card`, `move_card` all using `order`                   |
| `app/blueprints/cards/routes.py`           | New file: thin handlers, all `@token_required`, `{"data": ...}` envelope                               |
| `app/blueprints/notifications/__init__.py` | New blueprint registration                                                                             |
| `app/blueprints/notifications/routes.py`   | `GET /`, `PATCH /<id>/read`; `@token_required`; pagination in route                                    |
| `app/blueprints/notifications/service.py`  | `list_notifications` with offset pagination; `mark_read` with ownership check                          |
| `app/blueprints/notifications/schema.py`   | `CreateNotificationSchema`, `UpdateNotificationSchema`, `notification_to_dict`                         |
| `app/blueprints/analytics/__init__.py`     | New blueprint registration                                                                             |
| `app/blueprints/analytics/routes.py`       | `GET /boards/<board_id>/summary`; `@token_required`                                                    |
| `app/blueprints/analytics/service.py`      | `board_summary` with `func.count` join; no N+1; `completed = 0` stub documented                        |
| `app/blueprints/analytics/schema.py`       | `board_summary_to_dict` serialization helper                                                           |
| `app/blueprints/users/__init__.py`         | New blueprint registration                                                                             |
| `app/blueprints/users/routes.py`           | `GET /me`, `PATCH /me`; `@token_required`                                                              |
| `app/blueprints/users/service.py`          | `get_me`, `update_me`; writes `name` and `timezone`                                                    |
| `app/blueprints/users/schema.py`           | `UpdateUserSchema`, `user_to_dict` delegating to `User.to_dict()`                                      |
| `app/__init__.py`                          | Registers all three new blueprints; health check at `GET /api/health`; URL-prefix tech debt documented |
| `app/exceptions.py`                        | Added `NotificationNotFoundException`                                                                  |
| `migrations/versions/e75e73442f21_*.py`    | Initial migration: full schema including `order Float`, `deleted_at`, `notifications` table            |
| `tests/conftest.py`                        | `tables` imports `Notification`; `make_card` uses `order`; `seeded` uses `order`                       |
| `tests/test_cards_service.py`              | Tests updated to use `order` parameter                                                                 |

</details>
