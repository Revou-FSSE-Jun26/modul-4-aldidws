# RevoTask Backend — Implementation Plan

## Exploration findings

- **Python**: 3.14, **venv**: `c:\Users\aldid\modulAIdevelopment\venv\`
- **Flask** 3.1.3, **SQLAlchemy** 2.1.9, **Flask-Migrate** 4.1.0 / **Alembic** 1.20.1, **Marshmallow** 4.4.0, **PyJWT** 2.15.1
- `app/config.py` **does not exist** — `create_app()` calls `app.config.DevelopmentConfig` which currently fails at import. A minimal `app/config.py` is a prerequisite for running tests or migrations.
- `migrations/` **does not exist** → must run `flask db init` before `flask db migrate`.
- Schema files are named `schema.py` (not `schemas.py`) consistently across all blueprints.
- `app/blueprints/cards/routes.py` imports from `app.blueprints.cards.schema` (confirmed in source).
- `cards/service.py::move_card` parameter is named `position: int`; `cards/schema.py::CardPositionSchema` field is `position = fields.Integer(...)`.
- `cards/schema.py::card_to_dict` returns key `"position"`.
- `BoardColumn.position` is `Mapped[int] = mapped_column(Integer, ...)` — change type to `Float` only; keep the column name `position`.
- `Card.position` is `Mapped[int] = mapped_column(Integer, ...)` with `CheckConstraint('position >= 0', name='ck_cards_position_nonnegative')` and `Index('ix_cards_column_id_position', 'column_id', 'position')`.
- `User` model has no `name` column — needs adding as `String(255), nullable=True`.
- `app/models/__init__.py` imports six models; `Notification` is absent.
- `tests/conftest.py::tables` fixture imports the same six models.
- `token_required` decorator injects `current_user` as the first positional arg.
- Envelope pattern confirmed: success → `{"data": ...}`, error → `{"error": {"code", "message", "details"}}`.
- **No** `notifications/`, `analytics/`, or `users/` blueprint folders exist.
- **No** `app/models/notification.py` exists.
- `app/blueprints/comments/__init__.py` pattern (confirmed): creates blueprint then imports routes in one `__init__.py`.

---

## Prerequisites

> Items 0a and 0b are **not** in the original 14-task list but are hard dependencies
> that every subsequent item relies on. The implementer MUST do them first.

- [ ] **0a. Create `app/config.py`** — `create_app()` imports `app.config.DevelopmentConfig`
      which does not exist, making the application and all tests non-startable.
      Add a minimal config module with `DevelopmentConfig`, `TestingConfig`, and
      `ProductionConfig`. `TestingConfig` MUST set
      `SQLALCHEMY_DATABASE_URI` to read from `TEST_DATABASE_URL` env var (default
      `postgresql://localhost/test_modulai`) and `JWT_SECRET_KEY = "test-secret-key-for-tests-only"`,
      matching the existing hardcoded value in `tests/conftest.py`. `DevelopmentConfig`
      reads `DATABASE_URL` and `JWT_SECRET_KEY` from env (the `.env` file already has
      both).
      Files: `app/config.py`
      Verify: `venv\Scripts\python.exe -c "from app.config import DevelopmentConfig, TestingConfig; print('OK')"` exits 0.

---

## Task 1 — Fix Card model (position → order, Integer → Float, deleted_at, constraints, index)

Change the `Card` model so that `position` is renamed to `order` with type `Float`,
the check constraint name is updated, the index name is updated, and `deleted_at`
(nullable `DateTime(timezone=True)`) is added. Update `to_dict` to return
`"order"` instead of `"position"`. Remove the old `Integer` import if no longer used.

**All eight changes are within this single file:**

1. `Mapped[int]` → `Mapped[float]` for the ordering field.
2. Column name in `mapped_column` stays implicit (uses the Python attribute name),
   so rename the Python attribute from `position` to `order`.
3. Import `Float` from `sqlalchemy`, remove `Integer` import (no other column needs it).
4. `CheckConstraint('position >= 0', name='ck_cards_position_nonnegative')` →
   `CheckConstraint('"order" >= 0', name='ck_cards_order_nonneg')`.
   Use quoted column name in SQL expression because `order` is a reserved SQL keyword.
5. `Index('ix_cards_column_id_position', 'column_id', 'position')` →
   `Index('ix_cards_column_id_order', 'column_id', 'order')`.
6. Add `deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)`.
7. `to_dict`: replace `"position": self.position` with `"order": self.order` and add
   `"deleted_at": self.deleted_at.isoformat() if self.deleted_at else None`.
8. Update `__repr__` to reference `self.order`.

Files: `app/models/card.py`

Verify: `venv\Scripts\python.exe -c "from app.models.card import Card; c = Card.__table__; print([col.name for col in c.columns])"` — output includes `order` and NOT `position`; exits 0.

---

## Task 2 — Update cards/schema.py (CardPositionSchema: position → order Float; card_to_dict: position → order)

In `app/blueprints/cards/schema.py`:

1. `CardPositionSchema`: rename field `position = fields.Integer(...)` to
   `order = fields.Float(required=True, validate=validate.Range(min=0))`.
2. `card_to_dict`: replace `"position": card.position` with `"order": card.order`.

Do not change `CreateCardSchema`, `UpdateCardSchema`, or any other function.

Files: `app/blueprints/cards/schema.py`

Verify: `venv\Scripts\python.exe -c "from app.blueprints.cards.schema import CardPositionSchema, card_to_dict; print('OK')"` exits 0.

---

## Task 3 — Update cards/service.py (card.position → card.order; move_card parameter position → order: float)

In `app/blueprints/cards/service.py`:

1. Rename parameter `position: int` to `order: float` in `move_card()`.
2. Replace every reference to `Card.position` with `Card.order` and every
   reference to `card.position` with `card.order` throughout the file.
   Specific locations:
   - `_renormalise_positions`: `Card.position.asc()` → `Card.order.asc()`;
     `c.position = idx` → `c.order = idx`.
   - `create_card`: `func.max(Card.position)` → `func.max(Card.order)`;
     `position = 0 if max_pos is None else max_pos + 1` → keep same logic, rename variable `position` → `order` and `card.position = position` → `card.order = order`.
   - `move_card`: `card.position = position` → `card.order = order`.
3. Update the `Card(...)` constructor call in `create_card` to use
   keyword `order=order` (was `position=position`).
4. Update the docstring for `move_card` to reflect the renamed parameter.

Files: `app/blueprints/cards/service.py`

Verify: `venv\Scripts\python.exe -c "from app.blueprints.cards.service import create_card, move_card; print('OK')"` exits 0.

---

## Task 4 — Update cards/routes.py (data['position'] → data['order'])

In `app/blueprints/cards/routes.py`, the `move_card` route handler passes
`data["position"]` to `service.move_card`. Change it to `data["order"]`.

```python
# Before
card = service.move_card(
    current_user,
    uuid.UUID(card_id),
    data["column_id"],
    data["position"],
)

# After
card = service.move_card(
    current_user,
    uuid.UUID(card_id),
    data["column_id"],
    data["order"],
)
```

Files: `app/blueprints/cards/routes.py`

Verify: `venv\Scripts\python.exe -c "from app.blueprints.cards.routes import move_card; print('OK')"` exits 0.

---

## Task 5 — Fix BoardColumn model (position Integer → Float only)

In `app/models/board_column.py`, change only the type of the `position` column
from `Integer` to `Float`:

1. Add `Float` to the `sqlalchemy` imports, remove `Integer` (unused after change).
2. `Mapped[int]` → `Mapped[float]` for `position`.
3. `mapped_column(Integer, ...)` → `mapped_column(Float, ...)`.

Keep the Python attribute name `position`, the check constraint, the index, and
everything else unchanged.

Files: `app/models/board_column.py`

Verify: `venv\Scripts\python.exe -c "from app.models.board_column import BoardColumn; col = BoardColumn.__table__; t = col.c.position.type; print(type(t).__name__)"` prints `Float`; exits 0.

---

## Task 6 — Add GET /api/health endpoint in app/__init__.py

Add an inline health-check route to `create_app()` (before or after
`_register_blueprints`):

```python
@app.route("/api/health", methods=["GET"])
def health():
    from flask import jsonify
    return jsonify({"status": "ok"}), 200
```

This is an unauthenticated, infrastructure-level route and belongs directly
on the `app` object, not in a blueprint.

Files: `app/__init__.py`

Verify: Run `venv\Scripts\python.exe -c "from app import create_app; a = create_app('_test_config.TestConfig'); c = a.test_client(); r = c.get('/api/health'); print(r.status_code)"` — but `_test_config.TestConfig` requires a live DB for `db.init_app`. Instead verify with a quick route-listing check:
`venv\Scripts\python.exe -c "
import sys, types as _t, os
_m = _t.ModuleType('_test_config')
class TC: TESTING=True; SQLALCHEMY_DATABASE_URI='postgresql://localhost/nonexistent'; JWT_SECRET_KEY='x'; SQLALCHEMY_TRACK_MODIFICATIONS=False
_m.TestConfig = TC
sys.modules['_test_config'] = _m
from app import create_app
a = create_app('_test_config.TestConfig')
rules = [str(r) for r in a.url_map.iter_rules()]
assert any('/api/health' in r for r in rules), rules
print('health route present')
"` exits 0.

---

## Task 7 — Create app/models/notification.py

Create the `Notification` model following the same SQLAlchemy 2.x mapped-column
style used by every other model in `app/models/`.

```python
"""Notification model."""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.extensions import db


class Notification(db.Model):
    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_read: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    user: Mapped["User"] = relationship("User", lazy="select")  # type: ignore[name-defined]

    def to_dict(self) -> dict:
        return {
            "id": str(self.id),
            "user_id": str(self.user_id),
            "title": self.title,
            "body": self.body,
            "is_read": self.is_read,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }
```

Files: `app/models/notification.py`

Verify: `venv\Scripts\python.exe -c "from app.models.notification import Notification; print(Notification.__tablename__)"` prints `notifications`; exits 0.

---

## Task 8 — Create app/blueprints/notifications/ blueprint

Create four files matching the established blueprint pattern (see `app/blueprints/comments/` as the reference).

**`app/blueprints/notifications/__init__.py`**
```python
"""Notifications blueprint."""
from flask import Blueprint
notifications_bp = Blueprint("notifications", __name__)
from app.blueprints.notifications import routes  # noqa: E402, F401
```

**`app/blueprints/notifications/schema.py`**
```python
"""Notifications schemas and serialization."""
from marshmallow import Schema, fields, validate
from app.models.notification import Notification

class CreateNotificationSchema(Schema):
    title = fields.String(required=True, validate=validate.Length(min=1, max=255))
    body  = fields.String(load_default=None, validate=validate.Length(max=2000))

class UpdateNotificationSchema(Schema):
    is_read = fields.Boolean(required=False)

def notification_to_dict(n: Notification) -> dict:
    return n.to_dict()
```

**`app/blueprints/notifications/service.py`**
```python
"""Notifications service."""
import uuid
from app.exceptions import AppException
from app.extensions import db
from app.models.notification import Notification

class NotificationNotFoundException(AppException):
    status_code = 404
    error_code = "NOTIFICATION_NOT_FOUND"
    message = "Notification not found"

def list_notifications(current_user) -> list[Notification]:
    return db.session.execute(
        db.select(Notification)
        .where(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
    ).scalars().all()

def mark_read(current_user, notification_id: uuid.UUID) -> Notification:
    n = db.session.execute(
        db.select(Notification)
        .where(Notification.id == notification_id)
        .where(Notification.user_id == current_user.id)
    ).scalar_one_or_none()
    if n is None:
        raise NotificationNotFoundException()
    n.is_read = True
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise
    return n
```

**`app/blueprints/notifications/routes.py`**
```python
"""Notifications route handlers."""
import uuid
from flask import jsonify
from app.blueprints.auth.decorators import token_required
from app.blueprints.notifications import notifications_bp
from app.blueprints.notifications import service
from app.blueprints.notifications.schema import notification_to_dict

@notifications_bp.route("", methods=["GET"])
@token_required
def list_notifications(current_user):
    items = service.list_notifications(current_user)
    return jsonify({"data": [notification_to_dict(n) for n in items]}), 200

@notifications_bp.route("/<notification_id>/read", methods=["PATCH"])
@token_required
def mark_read(current_user, notification_id):
    n = service.mark_read(current_user, uuid.UUID(notification_id))
    return jsonify({"data": notification_to_dict(n)}), 200
```

Files: `app/blueprints/notifications/__init__.py`, `app/blueprints/notifications/schema.py`,
`app/blueprints/notifications/service.py`, `app/blueprints/notifications/routes.py`

Verify: `venv\Scripts\python.exe -c "from app.blueprints.notifications import notifications_bp; print(notifications_bp.name)"` prints `notifications`; exits 0.

---

## Task 9 — Create app/blueprints/analytics/ blueprint

Create four files. Analytics exposes aggregate read-only endpoints; no mutations.

**`app/blueprints/analytics/__init__.py`**
```python
"""Analytics blueprint."""
from flask import Blueprint
analytics_bp = Blueprint("analytics", __name__)
from app.blueprints.analytics import routes  # noqa: E402, F401
```

**`app/blueprints/analytics/schema.py`**
```python
"""Analytics serialization helpers (no request schemas needed — GET only)."""

def board_summary_to_dict(board_id, total_cards, completed_cards) -> dict:
    return {
        "board_id": str(board_id),
        "total_cards": total_cards,
        "completed_cards": completed_cards,
    }
```

**`app/blueprints/analytics/service.py`**
```python
"""Analytics service."""
import uuid
from sqlalchemy import func
from app.exceptions import BoardNotFoundException
from app.extensions import db
from app.models.board import Board
from app.models.board_column import BoardColumn
from app.models.card import Card

def board_summary(current_user, board_id: uuid.UUID) -> dict:
    board = db.session.execute(
        db.select(Board).where(
            Board.id == board_id,
            Board.owner_id == current_user.id,
        )
    ).scalar_one_or_none()
    if board is None:
        raise BoardNotFoundException()

    total = db.session.execute(
        db.select(func.count(Card.id))
        .join(Card.column)
        .where(BoardColumn.board_id == board_id)
    ).scalar() or 0

    # "completed" means deleted_at IS NOT NULL (soft-deleted = done).
    completed = db.session.execute(
        db.select(func.count(Card.id))
        .join(Card.column)
        .where(BoardColumn.board_id == board_id)
        .where(Card.deleted_at.is_not(None))
    ).scalar() or 0

    return {
        "board_id": board_id,
        "total_cards": total,
        "completed_cards": completed,
    }
```

**`app/blueprints/analytics/routes.py`**
```python
"""Analytics route handlers."""
import uuid
from flask import jsonify
from app.blueprints.auth.decorators import token_required
from app.blueprints.analytics import analytics_bp
from app.blueprints.analytics import service
from app.blueprints.analytics.schema import board_summary_to_dict

@analytics_bp.route("/boards/<board_id>/summary", methods=["GET"])
@token_required
def board_summary(current_user, board_id):
    summary = service.board_summary(current_user, uuid.UUID(board_id))
    return jsonify({"data": board_summary_to_dict(
        summary["board_id"], summary["total_cards"], summary["completed_cards"]
    )}), 200
```

Files: `app/blueprints/analytics/__init__.py`, `app/blueprints/analytics/schema.py`,
`app/blueprints/analytics/service.py`, `app/blueprints/analytics/routes.py`

Verify: `venv\Scripts\python.exe -c "from app.blueprints.analytics import analytics_bp; print(analytics_bp.name)"` prints `analytics`; exits 0.

---

## Task 10 — Create app/blueprints/users/ blueprint

Create four files. Users exposes the authenticated user's own profile (GET) and
a PATCH to update `name` and `timezone`.

**`app/blueprints/users/__init__.py`**
```python
"""Users blueprint."""
from flask import Blueprint
users_bp = Blueprint("users", __name__)
from app.blueprints.users import routes  # noqa: E402, F401
```

**`app/blueprints/users/schema.py`**
```python
"""Users request schemas and serialization."""
from marshmallow import Schema, fields, validate
from app.models.user import User

class UpdateUserSchema(Schema):
    name     = fields.String(required=False, validate=validate.Length(max=255))
    timezone = fields.String(required=False, validate=validate.Length(max=64))

def user_to_dict(user: User) -> dict:
    d = user.to_dict()
    # Include name if the column has been added (task 13); default to None for
    # forward-compat if the attribute does not yet exist.
    d["name"] = getattr(user, "name", None)
    return d
```

**`app/blueprints/users/service.py`**
```python
"""Users service."""
from app.extensions import db
from app.models.user import User

def get_me(current_user) -> User:
    return current_user

def update_me(current_user, data: dict) -> User:
    if "name" in data:
        current_user.name = data["name"]
    if "timezone" in data:
        current_user.timezone = data["timezone"]
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise
    return current_user
```

**`app/blueprints/users/routes.py`**
```python
"""Users route handlers."""
from flask import jsonify, request
from app.blueprints.auth.decorators import token_required
from app.blueprints.users import users_bp
from app.blueprints.users import service
from app.blueprints.users.schema import UpdateUserSchema, user_to_dict

@users_bp.route("/me", methods=["GET"])
@token_required
def get_me(current_user):
    return jsonify({"data": user_to_dict(service.get_me(current_user))}), 200

@users_bp.route("/me", methods=["PATCH"])
@token_required
def update_me(current_user):
    data = UpdateUserSchema().load(request.get_json() or {}, partial=True)
    user = service.update_me(current_user, data)
    return jsonify({"data": user_to_dict(user)}), 200
```

Files: `app/blueprints/users/__init__.py`, `app/blueprints/users/schema.py`,
`app/blueprints/users/service.py`, `app/blueprints/users/routes.py`

Verify: `venv\Scripts\python.exe -c "from app.blueprints.users import users_bp; print(users_bp.name)"` prints `users`; exits 0.

---

## Task 11 — Register new blueprints in app/__init__.py

In `_register_blueprints()`, add imports and registrations for the three new blueprints.
Also add the `flask_migrate` `Migrate` extension initialisation to `create_app()` so that
`flask db` commands work (Flask-Migrate 4.1.0 is already installed).

**In `app/__init__.py`:**

1. At top of `create_app`, add:
   ```python
   from flask_migrate import Migrate
   ```
   (or add to imports at the top of the file — either works; keep consistent with existing style).

2. After `db.init_app(app)`, add:
   ```python
   Migrate(app, db)
   ```

3. In `_register_blueprints`, add after the existing registrations:
   ```python
   from app.blueprints.notifications import notifications_bp
   from app.blueprints.analytics import analytics_bp
   from app.blueprints.users import users_bp

   app.register_blueprint(notifications_bp, url_prefix="/api/notifications")
   app.register_blueprint(analytics_bp,     url_prefix="/api/analytics")
   app.register_blueprint(users_bp,         url_prefix="/api/users")
   ```

Files: `app/__init__.py`

Verify: Run the same route-listing snippet as Task 6 and additionally assert that
`/api/notifications`, `/api/analytics`, and `/api/users` appear in `url_map`.

```
venv\Scripts\python.exe -c "
import sys, types as _t
_m = _t.ModuleType('_test_config')
class TC: TESTING=True; SQLALCHEMY_DATABASE_URI='postgresql://localhost/nonexistent'; JWT_SECRET_KEY='x'; SQLALCHEMY_TRACK_MODIFICATIONS=False
_m.TestConfig = TC
sys.modules['_test_config'] = _m
from app import create_app
a = create_app('_test_config.TestConfig')
rules = [str(r) for r in a.url_map.iter_rules()]
for path in ['/api/health', '/api/notifications', '/api/analytics/boards/<board_id>/summary', '/api/users/me']:
    assert any(path in r for r in rules), f'Missing: {path}  Rules: {rules}'
print('all routes present')
"
```

---

## Task 12 — Update app/models/__init__.py (add Notification import)

Add `from app.models.notification import Notification  # noqa: F401` after the
`RefreshToken` import, following the established ordering (parent before child,
alphabetical within same level). The comment at the top of the file already
explains the purpose.

Files: `app/models/__init__.py`

Verify: `venv\Scripts\python.exe -c "from app.models import Notification; print(Notification.__tablename__)"` prints `notifications`; exits 0.

---

## Task 13 — Update tests/conftest.py (add Notification to tables fixture imports only)

In `tests/conftest.py`, the `tables` fixture imports six models explicitly:
```python
from app.models import (
    User, Board, BoardColumn, Card, CardComment, RefreshToken,
)
```
Add `Notification` to this import. Touch **nothing else** in the file.

Also add `name` column to `User` model (`app/models/user.py`) since the users
blueprint's `user_to_dict` and the `update_me` service both write `user.name`,
and a migration will need it. Add:
```python
name: Mapped[str | None] = mapped_column(
    String(255),
    nullable=True,
)
```
in the "Profile columns" section, after `email`.

Files: `tests/conftest.py`, `app/models/user.py`

Verify:
```
venv\Scripts\python.exe -c "
from app.models.user import User
col = User.__table__.c['name']
print(col.name, col.nullable)
"
```
Prints `name True`; exits 0.

---

## Task 14 — Run database migration

> This task requires a live PostgreSQL instance. The `.env` file at
> `app/.env` configures `DATABASE_URL=postgresql://postgres:aldi17@localhost:5432/RevoTask`.
> Load those env vars before running Flask CLI commands.

**Step 14a — Check for migrations/ folder and initialise if absent:**

```powershell
# From repo root with venv activated and env vars loaded:
if (-not (Test-Path "migrations")) {
    flask db init
}
```

**Step 14b — Generate the migration:**

```powershell
flask db migrate -m "card_order_float_deleted_at_user_name_notification"
```

**Step 14c — Review the generated migration file** in `migrations/versions/`.
Confirm it includes:
- Rename column `cards.position` → `cards.order` (or `ALTER COLUMN` to `FLOAT`
  plus rename — Alembic autogenerate may produce an `op.alter_column` or
  `op.drop_column` / `op.add_column` pair; either is acceptable as long as
  data is preserved).
- Drop `ck_cards_position_nonnegative`, add `ck_cards_order_nonneg`.
- Drop `ix_cards_column_id_position`, add `ix_cards_column_id_order`.
- Alter `board_columns.position` from `INTEGER` to `FLOAT` (keeping name).
- Add `cards.deleted_at TIMESTAMP WITH TIME ZONE NULL`.
- Add `users.name VARCHAR(255) NULL`.
- Create `notifications` table with all columns from Task 7.

**Step 14d — Apply the migration:**

```powershell
flask db upgrade
```

Files: `migrations/` (created by `flask db init`), `migrations/versions/<hash>_card_order_float_deleted_at_user_name_notification.py`

Verify:
```powershell
flask db current
```
Output shows the new revision as `(head)`.

---

## Task 15 — Run pytest tests/ -v and report exact results

> This task requires a live PostgreSQL test database. The conftest reads
> `TEST_DATABASE_URL` (defaults to `postgresql://localhost/test_modulai`).
> Create that database if it does not exist before running.

```powershell
$env:TEST_DATABASE_URL = "postgresql://postgres:aldi17@localhost:5432/test_modulai"
venv\Scripts\pytest tests\ -v 2>&1
```

Expected passing tests (confirmed from code reading):
- `tests/test_auth_service.py` — 4 tests
- `tests/test_cards_service.py` — 5 tests (these reference `Card.position`/`card.position`
  in assertions; after Tasks 1–3 these must be updated to reference `card.order` or the
  tests will fail — **update the assertions and the `make_card` position kwargs to `order`
  before running**)
- `tests/test_comments.py` — 4 tests

**Important**: `test_cards_service.py` uses `position=0`, `position=1`, etc.
in `make_card()` calls and asserts `card.position`. After Tasks 1–3, the `Card`
model no longer has a `position` attribute. Update all `make_card(col, user, position=N)`
calls to `make_card(col, user, order=N)` and all `card.position` assertions to
`card.order` in `tests/test_cards_service.py`.

Similarly update `conftest.py::make_card` factory (keyword argument `position: int = 0`
→ `order: float = 0.0`) and `conftest.py::seeded` fixture (`position=0`, `position=1` →
`order=0`, `order=1`).

Report the **exact** pytest output, distinguishing passed, failed, and errored tests.
Do not claim success without running the command.

Files: `tests/test_cards_service.py`, `tests/conftest.py` (make_card factory + seeded fixture)

Verify: `venv\Scripts\pytest tests\ -v` exits 0 with all tests collected and passing.

---

## Dependency order summary

```
0a (config.py) → 1 (Card model) → 2 (cards/schema) → 3 (cards/service) → 4 (cards/routes)
0a             → 5 (BoardColumn model)
0a             → 6 (health route)
0a             → 7 (Notification model)
7              → 8 (notifications blueprint)
0a             → 9 (analytics blueprint)
0a             → 10 (users blueprint)
6 + 8 + 9 + 10 → 11 (register blueprints)
7              → 12 (models/__init__)
13 (User.name) depends on knowing users blueprint is done (Task 10), but can be done alongside it
11 + 12 + 13   → 14 (migration)
1 + 2 + 3 + 15 → update tests → 15 (pytest run)
```
