"""Cards request schemas and serialization helpers."""

from marshmallow import Schema, ValidationError, fields, validate

from app.models.card import Card


class CreateCardSchema(Schema):
    title = fields.String(
        required=True,
        validate=validate.Length(min=1, max=255),
    )
    description = fields.String(
        load_default="",
        validate=validate.Length(max=2000),
    )
    # priority is accepted for forward-compatibility but the Card model does
    # not yet have this column; the service layer silently ignores it.
    priority = fields.String(
        load_default="medium",
        validate=validate.OneOf(["low", "medium", "high"]),
    )

    def load(self, data, **kwargs):
        result = super().load(data, **kwargs)
        result["title"] = result["title"].strip()
        if not result["title"]:
            raise ValidationError({"title": ["Title must not be blank."]})
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
    # priority and status are accepted for forward-compatibility; both are
    # silently ignored by the service until the model gains those columns.
    priority = fields.String(
        required=False,
        validate=validate.OneOf(["low", "medium", "high"]),
    )
    status = fields.String(
        required=False,
        validate=validate.OneOf(["todo", "in_progress", "done"]),
    )

    def load(self, data, **kwargs):
        result = super().load(data, **kwargs)
        if "title" in result:
            result["title"] = result["title"].strip()
            if not result["title"]:
                raise ValidationError({"title": ["Title must not be blank."]})
        return result


class CardPositionSchema(Schema):
    column_id = fields.UUID(required=True)
    order = fields.Float(required=True, validate=validate.Range(min=0))


def card_to_dict(card: Card) -> dict:
    """Serialise a Card to a safe, API-facing dictionary.

    Only fields that physically exist on the Card model are included.
    priority and status are omitted until the model gains those columns.
    """
    return {
        "id": str(card.id),
        "column_id": str(card.column_id),
        "owner_id": str(card.owner_id),
        "title": card.title,
        "description": card.description,
        "order": card.order,
        "deleted_at": card.deleted_at.isoformat() if card.deleted_at else None,
        "created_at": card.created_at.isoformat(),
        "updated_at": card.updated_at.isoformat(),
    }
