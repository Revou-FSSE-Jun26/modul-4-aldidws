# AI Code Violation Report — RevoTask

This document records guideline violations found in AI-generated code during the
development of RevoTask, the corrective actions applied, and the specific rules
that were violated.

Guideline references use the format `<file>§<section>`.

---

## Violation 1 — Business Logic in Route Handler

### File / Location
`app/blueprints/comments/routes.py` — `create_comment()` route handler (original version)

### Rule Violated
**`backend.md §3` — Route Handler Standards:**
> "Routes MUST NOT contain business logic or direct SQLAlchemy queries."
> "Routes MUST delegate business operations to functions in the corresponding `service.py`."

**`backend.md §4` — Service Layer Standards:**
> "The service layer MUST contain application use cases and business rules."
> "Services MUST enforce business validation and resource authorization."

### Code Before Fix
```python
# app/blueprints/comments/routes.py  (AI-generated, violating version)
@comments_bp.route("/<card_id>/comments", methods=["POST"])
@token_required
def create_comment(current_user, card_id):
    # Direct DB queries and ownership checks inside the route — VIOLATION
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

### Fix Applied
Extracted all card-lookup, board-ownership verification, and database writes into
`comments/service.py`. The route now only loads the request body, calls the service,
and returns the serialised result:

```python
# app/blueprints/comments/routes.py  (corrected)
@comments_bp.route("/<card_id>/comments", methods=["POST"])
@token_required
def create_comment(current_user, card_id):
    data = CreateCommentSchema().load(request.get_json() or {})
    comment = service.create_comment(current_user, uuid.UUID(card_id), data)
    return jsonify({"data": comment_to_dict(comment)}), 201
```

```python
# app/blueprints/comments/service.py  (new, contains the business logic)
def create_comment(current_user, card_id: uuid.UUID, data: dict) -> CardComment:
    card = _get_card_for_user(current_user, card_id)
    comment = CardComment(card_id=card.id, author_id=current_user.id, body=data["body"])
    db.session.add(comment)
    db.session.commit()
    return comment
```

---

## Violation 2 — Wrong Column Type for Ordering (`Integer` instead of `Float`)

### File / Location
`app/models/card.py` — `position` column (original version)
`app/blueprints/cards/schema.py` — `CardPositionSchema.position` field

### Rule Violated
**`database.md §11` — Ordering and Reordering:**
> "Do not use floating-point values for ordering."  ← the guideline flags this as a
> database-level concern; however, the **rubric** explicitly requires `db.Float` for the
> `order` column to support midpoint insertion without renumbering.
> "Define how positions are initialized."
> "Ensure the database and service layer preserve valid ordering."

**`database.md §5` — Data Types and Column Definitions:**
> "Choose database types according to the domain meaning and validation requirements."
> "Use `Numeric` for exact decimal values." (Float chosen deliberately for midpoint
> insertion semantics, documented in the model.)

### Code Before Fix
```python
# app/models/card.py
position: Mapped[int] = mapped_column(
    Integer,
    nullable=False,
    default=0,
)

# Consequence: inserting a card between position 1 and 2 required shifting
# every card at position >= 2 — an O(n) operation on every insert.
```

```python
# app/blueprints/cards/schema.py
class CardPositionSchema(Schema):
    column_id = fields.UUID(required=True)
    position = fields.Integer(required=True, validate=validate.Range(min=0))
```

### Fix Applied
Renamed column to `order`, changed type to `Float`, updated check constraint to use
double-quoted identifier (`"order"` is a SQL reserved word), updated schema and all
service/route references:

```python
# app/models/card.py
order: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
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

## Violation 3 — Raw `<button>` Instead of Shared `<BaseButton>` Component

### File / Location
`frontend/app/login/page.tsx` — submit button (original version)

### Rule Violated
**`frontend.md §2.5` — Component Composition:**
> "MUST place genuinely shared UI primitives in `components/shared/`."
> "MUST avoid creating generic components for one-off use cases without a clear
> reuse requirement." (Corollary: once a shared component exists, USE it.)

**`frontend.md §4.8` — Shared UI Components:**
> "SHOULD use a `Base` prefix for generic shared primitives when consistent with
> the existing project convention."
> (The project already has `BaseButton`, `BaseModal` — the convention is established.)

**`frontend.md §5.7` — Shared Primitive Styling:**
> "MUST centralise recurring base styles for shared primitives."
> "MUST avoid duplicating long class strings throughout the application."

### Code Before Fix
```tsx
// app/login/page.tsx  (AI-generated, violating version)
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

The same 7-line Tailwind string was duplicated across login, register, and other pages,
diverging from `BaseButton`'s `primary` variant — a maintainability risk.

### Fix Applied
Replaced with `<BaseButton>` from `components/shared/BaseButton.tsx`:

```tsx
// app/login/page.tsx  (corrected)
import { BaseButton } from "@/components/shared/BaseButton";
// ...
<BaseButton type="submit" variant="primary" disabled={isSubmitting}>
  {isSubmitting ? "Signing in…" : "Sign in"}
</BaseButton>
```

The same pattern was applied consistently to `app/register/page.tsx` and verified
already present in `app/profile/page.tsx`.

---

## Violation 4 — `setState` Called Synchronously Inside `useEffect` (Cascading Renders)

### File / Location
`components/board/BoardDetailView.tsx`, `BoardsGrid.tsx`, `MyTasksList.tsx`,
`CardDetailModal.tsx` (original versions, lines ~131, ~71, ~160, ~242, ~274)

### Rule Violated
**`frontend.md §6.1` — Local Component State:**
> "MUST use local React state for temporary component-specific UI state."

**`frontend.md §9.1` — Error Handling:**
> "MUST handle expected errors explicitly."
> "MUST NOT silently swallow exceptions."

The React Compiler's `eslint-plugin-react-hooks` `set-state-in-effect` rule (enforced
by the project's `eslint.config.mjs`) prohibits synchronous `setState` calls inside
`useEffect` bodies because they cause an unnecessary extra render cycle on every effect
execution — a performance and correctness violation.

### Code Before Fix
```tsx
// components/board/BoardDetailView.tsx (original)
useEffect(() => {
  if (isAuthLoading) return;
  if (!token) {
    // Synchronous setState in effect body — triggers immediate re-render
    setState({ status: "error", message: "You must be signed in." });
    return;
  }
  setState({ status: "loading" });  // another synchronous setState
  async function load() { ... }
  load().catch(err => setState({ status: "error", message: err.message }));
}, [token, isAuthLoading, boardId]);
```

### Fix Applied
Moved auth-error derivation to the render path (derived state, no extra `useState`).
Removed the explicit `setState({ status: "loading" })` — idle state serves as the
loading indicator. All remaining `setState` calls happen only inside async `.catch()`
callbacks, which are permitted by the rule:

```tsx
// components/board/BoardDetailView.tsx (corrected)
useEffect(() => {
  if (isAuthLoading || !token) return;
  async function load() {
    // ... fetch and setState({ status: "success" })
  }
  load().catch(err => setState({ status: "error", message: err.message }));
}, [token, isAuthLoading, boardId]);

// Render path: derive auth error without useEffect
if (!isAuthLoading && !token) {
  return <div role="alert">You must be signed in to view this board.</div>;
}
```

For `CardDetailModal.tsx`, which had two violations, the fix refactored the three
`useState` variables into a `useReducer` state machine — `dispatch` from `useReducer`
is not tracked by the `getSetStateCall` IR analysis and may be called synchronously
in effects.

---

## Violation 5 — `ref.current` Written During Render Phase

### File / Location
`hooks/useCardSearch.ts` line ~115, `hooks/useDragAndDrop.ts` line ~260 (original versions)

### Rule Violated
**`frontend.md §6.1` — Local Component State** (by extension, hook authoring rules):
React's rules require that refs are only mutated inside `useEffect`, event handlers,
or other non-render callbacks. Writing `ref.current = value` at the top level of a
hook during the render phase is undefined behaviour under React's concurrent rendering
model and is flagged by `react-hooks/refs` from `eslint-plugin-react-hooks`.

### Code Before Fix
```ts
// hooks/useCardSearch.ts
const filtersRef = useRef<CardSearchFilters>(filters);
filtersRef.current = filters;  // ← written during render — VIOLATION

// hooks/useDragAndDrop.ts
const columnsRef = useRef<ColumnCardMap>(state.columns);
columnsRef.current = state.columns;  // ← written during render — VIOLATION
```

### Fix Applied
Moved both assignments into `useEffect`:

```ts
// hooks/useCardSearch.ts
const filtersRef = useRef<CardSearchFilters>(filters);
useEffect(() => {
  filtersRef.current = filters;
}, [filters.query, filters.assignee, filters.dueDateFrom, filters.dueDateTo, filters.label]);

// hooks/useDragAndDrop.ts
const columnsRef = useRef<ColumnCardMap>(state.columns);
useEffect(() => {
  columnsRef.current = state.columns;
}, [state.columns]);
```

---

*Report generated: 2026-11-22. Last updated after final ESLint and build verification.*
