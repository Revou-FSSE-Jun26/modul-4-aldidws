"""Cards request schemas and serialization helpers."""

from datetime import datetime, timezone

from marshmallow import Schema, ValidationError, fields, validate

from app.models.card import Card
from app.utils.time import format_utc


_DUE_MIN_YEAR = 2000
_DUE_MAX_YEAR = 2100
_DUE_RANGE_MESSAGE = "Due date must be between the years 2000 and 2100."


def _normalise_due_date(value: datetime) -> datetime:
    """Validate an aware due date and return it in UTC without microseconds.

    The year is checked before converting because ``astimezone`` raises
    ``OverflowError`` close to year 1 and year 9999.
    """
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValidationError(
            {"due_date": ["Due date must include a UTC offset, for example Z or +07:00."]}
        )
    if value.year < _DUE_MIN_YEAR - 1 or value.year > _DUE_MAX_YEAR + 1:
        raise ValidationError({"due_date": [_DUE_RANGE_MESSAGE]})
    try:
        utc_value = value.astimezone(timezone.utc)
    except OverflowError:
        raise ValidationError({"due_date": [_DUE_RANGE_MESSAGE]}) from None
    if not _DUE_MIN_YEAR <= utc_value.year <= _DUE_MAX_YEAR:
        raise ValidationError({"due_date": [_DUE_RANGE_MESSAGE]})
    return utc_value.replace(microsecond=0)


class CreateCardSchema(Schema):
    title = fields.String(
        required=True,
        validate=validate.Length(min=1, max=255),
    )
    description = fields.String(
        load_default="",
        validate=validate.Length(max=2000),
    )
    # priority: null means no priority; low/medium/high are the allowed values.
    priority = fields.String(
        load_default=None,
        allow_none=True,
        validate=validate.OneOf(["low", "medium", "high"]),
    )
    due_date = fields.DateTime(format="iso", required=False, allow_none=True)
    # Where the new card is placed in its column. Omitted means the bottom.
    position = fields.String(
        load_default="bottom",
        validate=validate.OneOf(["top", "bottom"]),
    )

    def load(self, data, **kwargs):
        result = super().load(data, **kwargs)
        result["title"] = result["title"].strip()
        if not result["title"]:
            raise ValidationError({"title": ["Title must not be blank."]})
        if result.get("due_date") is not None:
            result["due_date"] = _normalise_due_date(result["due_date"])
        return result


class UpdateCardSchema(Schema):
    title = fields.String(
        required=False,
        validate=validate.Length(min=1, max=255),
    )
    description = fields.String(
        required=False,
        validate=validate.Length(max=2000),
    )
    # priority: null means no priority (clear); low/medium/high are the allowed values.
    # allow_none=True so an explicit null clears the priority.
    priority = fields.String(
        required=False,
        allow_none=True,
        validate=validate.OneOf(["low", "medium", "high"]),
    )
    status = fields.String(
        required=False,
        validate=validate.OneOf(["todo", "in_progress", "done"]),
    )
    due_date = fields.DateTime(format="iso", required=False, allow_none=True)

    def load(self, data, **kwargs):
        result = super().load(data, **kwargs)
        if "title" in result:
            result["title"] = result["title"].strip()
            if not result["title"]:
                raise ValidationError({"title": ["Title must not be blank."]})
        if result.get("due_date") is not None:
            result["due_date"] = _normalise_due_date(result["due_date"])
        return result


class CardPositionSchema(Schema):
    column_id = fields.UUID(required=True)
    order = fields.Float(required=True, validate=validate.Range(min=0))


class CardListQuerySchema(Schema):
    """Query parameters for GET /api/v1/cards. Unknown keys are rejected."""

    search = fields.String(
        required=False,
        validate=validate.Length(min=1, max=100),
    )
    board_id = fields.UUID(required=False)
    mine = fields.Boolean(load_default=False)
    page = fields.Integer(load_default=1, validate=validate.Range(min=1))
    per_page = fields.Integer(load_default=20, validate=validate.Range(min=1, max=100))


def sort_labels(labels) -> list:
    """Order labels by lower-cased name, name, id, independent of DB collation."""
    return sorted(labels, key=lambda l: (l.name.lower(), l.name, str(l.id)))


def card_to_dict(
    card: Card,
    can_move: bool | None = None,
    assignee_ids: list[str] | None = None,
) -> dict:
    """Serialise a Card to a safe, API-facing dictionary.

    Only fields that physically exist on the Card model are included.  When
    *can_move* is not None the payload carries a ``can_move`` flag so the
    client knows whether the caller may drag this card (computed server-side
    for the caller; the client must treat it as authoritative UI state only —
    the server re-validates every move).  *assignee_ids* carries the board-
    member ids tagged on the card and is emitted only on board-detail
    payloads.
    """
    data = {
        "id": str(card.id),
        "column_id": str(card.column_id),
        "owner_id": str(card.owner_id),
        "title": card.title,
        "description": card.description,
        "order": card.order,
        "due_date": format_utc(card.due_date),
        "priority": card.priority,
        "labels": [
            {"id": str(l.id), "name": l.name, "color": l.color}
            for l in sort_labels(card.labels)
        ],
        "deleted_at": card.deleted_at.isoformat() if card.deleted_at else None,
        "created_at": card.created_at.isoformat(),
        "updated_at": card.updated_at.isoformat(),
    }
    if can_move is not None:
        data["can_move"] = can_move
    if assignee_ids is not None:
        data["assignee_ids"] = [str(a) for a in assignee_ids]
    return data


def card_with_context_to_dict(row, assignee_ids: list[str] | None = None) -> dict:
    """Serialise a ``(Card, column_name, board_id, board_name, assignee_ids)`` row.

    The 5th element of ``row`` is the assignee list (empty list when no one is
    assigned).  The optional ``assignee_ids`` parameter overrides the 5th
    element when it is passed explicitly.
    """
    if len(row) == 5:
        card, column_name, board_id, board_name, row_assignee_ids = row
        assignee_ids = assignee_ids if assignee_ids is not None else row_assignee_ids
    else:
        card, column_name, board_id, board_name = row
    data = card_to_dict(card, assignee_ids=assignee_ids)
    data["board_id"] = str(board_id)
    data["board_name"] = board_name
    data["column_name"] = column_name
    return data
