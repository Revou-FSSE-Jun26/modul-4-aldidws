# Backend Engineering Guidelines — RevoTask

Five rules that were enforced or violated during RevoTask development.

---

## Thin Route Handlers

### Rule
Every route handler MUST remain thin and focused on HTTP responsibilities. Routes MUST delegate all business operations to functions in the corresponding `service.py`. Routes MUST NOT contain direct SQLAlchemy queries, ownership checks, or transaction management.

### Rationale
Embedding business logic inside route handlers makes it untestable without a running Flask request context, couples HTTP transport to domain logic, and forces duplicate authorization code across related endpoints.

### RevoTask Example
```python
# WRONG — business logic and DB query inside the route handler
@comments_bp.route("/<card_id>/comments", methods=["POST"])
@token_required
def create_comment(current_user, card_id):
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

# CORRECT — route is thin; business logic lives in service.py
@comments_bp.route("/<card_id>/comments", methods=["POST"])
@token_required
def create_comment(current_user, card_id):
    data = CreateCommentSchema().load(request.get_json() or {})
    comment = service.create_comment(current_user, uuid.UUID(card_id), data)
    return jsonify({"data": comment_to_dict(comment)}), 201
```

---

## Service Layer Owns Business Logic

### Rule
The service layer MUST contain all application use cases, business rules, and resource authorization. Services MUST remain independent of Flask `request` and `response` objects. Services MUST raise typed `AppException` subclasses for expected failures.

### Rationale
Services that are independent of Flask can be tested with plain Python. Raising typed exceptions allows the global error handler to format consistent responses without duplicating error formatting code across blueprints.

### RevoTask Example
```python
# app/blueprints/comments/service.py
def create_comment(current_user, card_id: uuid.UUID, data: dict) -> CardComment:
    # Ownership + existence check in one helper — raises AppException on failure
    card = _get_card_for_user(current_user, card_id)
    comment = CardComment(card_id=card.id, author_id=current_user.id, body=data["body"])
    db.session.add(comment)
    db.session.commit()
    return comment

def _get_card_for_user(current_user, card_id: uuid.UUID) -> Card:
    card = db.session.get(Card, card_id)
    if card is None:
        raise CardNotFoundException()
    board = db.session.get(Board, card.column.board_id)
    if board is None or board.owner_id != current_user.id:
        raise UnauthorizedBoardAccessError()
    return card
```

---

## Float Order Column for Cards

### Rule
Card ordering MUST use a `Float` column named `order` instead of an `Integer` column named `position`. The schema validator for reorder operations MUST accept a `float` value for `order`.

### Rationale
Integer ordering requires renumbering every subsequent card when inserting between two existing cards (O(n) writes). Float ordering supports midpoint insertion: placing a card between `order=1.0` and `order=2.0` assigns `order=1.5` with zero additional writes.

### RevoTask Example
```python
# WRONG — integer forces O(n) renumbering on every insert
class Card(db.Model):
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

# CORRECT — float allows midpoint insertion
class Card(db.Model):
    order: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    __table_args__ = (
        CheckConstraint('"order" >= 0', name="ck_cards_order_nonnegative"),
        Index("ix_cards_column_id_order", "column_id", "order"),
    )

# Schema — must accept float, not integer
class CardPositionSchema(Schema):
    column_id = fields.UUID(required=True)
    order = fields.Float(required=True, validate=validate.Range(min=0))
```

---

## Typed Exception Hierarchy

### Rule
All expected application failures MUST use typed subclasses of `AppException` defined in `app/common/exceptions.py`. Route handlers MUST NOT return ad-hoc error responses. The global error handler in `app/common/error_handlers.py` serialises all `AppException` instances.

### Rationale
A single error-formatting path eliminates inconsistent response shapes across blueprints and makes it straightforward to add new failure modes without touching route code.

### RevoTask Example
```python
# app/common/exceptions.py
class CardNotFoundException(AppException):
    status_code = 404
    error_code = "CARD_NOT_FOUND"
    message = "Card not found"

class UnauthorizedBoardAccessError(AppException):
    status_code = 403
    error_code = "BOARD_ACCESS_DENIED"
    message = "You do not have access to this board"

# app/common/error_handlers.py
@app.errorhandler(AppException)
def handle_app_exception(err: AppException):
    return jsonify({
        "error": {"code": err.error_code, "message": err.message, "details": err.details}
    }), err.status_code
```

---

## Standard Response Envelope

### Rule
All successful API responses MUST use a `{"data": ...}` envelope. All error responses MUST use a `{"error": {"code": "...", "message": "...", "details": ...}}` envelope. Plain string error values such as `{"error": "Not found"}` are prohibited.

### Rationale
A consistent envelope allows the frontend `isFlaskErrorEnvelope` type guard and error-normalisation utilities to work reliably across all endpoints. Inconsistent shapes break client error handling silently.

### RevoTask Example
```python
# WRONG — plain string error value
return jsonify({"error": "Card not found"}), 404

# CORRECT — structured envelope
return jsonify({
    "error": {"code": "CARD_NOT_FOUND", "message": "Card not found", "details": None}
}), 404

# CORRECT — success envelope
return jsonify({"data": card.to_dict()}), 200

# CORRECT — paginated collection
return jsonify({
    "data": [c.to_dict() for c in cards],
    "meta": {"page": page, "per_page": per_page, "total": total}
}), 200
```
