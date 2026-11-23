# Changelog — RevoTask

All notable changes to this project are documented in this file.

This changelog follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

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

## Versioned Releases

No versioned releases have been published yet.
Refer to the [Unreleased] section above and the AI Improvement Log for current changes.

[Unreleased]: https://github.com/example/revotask/compare/HEAD
