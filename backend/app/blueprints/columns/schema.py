"""Columns request schemas and serialization helpers."""

from marshmallow import Schema, ValidationError, fields, validate

from app.models.board_column import BoardColumn


COLUMN_COLORS = ("gray", "blue", "orange", "green", "red")


class StrictBoolean(fields.Boolean):
    """Accepts only JSON true/false (no "true", 1 or 0)."""

    def _deserialize(self, value, attr, data, **kwargs):
        if not isinstance(value, bool):
            raise self.make_error("invalid", input=value)
        return value


class CreateColumnSchema(Schema):
    name = fields.String(
        required=True,
        validate=validate.Length(min=1, max=100),
    )
    position = fields.Integer(
        load_default=None,
        validate=validate.Range(min=0),
    )
    color = fields.String(
        required=False,
        allow_none=True,
        validate=validate.OneOf(COLUMN_COLORS),
    )
    is_done = StrictBoolean(required=False)

    def load(self, data, **kwargs):
        result = super().load(data, **kwargs)
        result["name"] = result["name"].strip()
        if not result["name"]:
            raise ValidationError({"name": ["Name must not be blank."]})
        return result


class UpdateColumnSchema(Schema):
    name = fields.String(
        required=False,
        validate=validate.Length(min=1, max=100),
    )
    position = fields.Integer(
        required=False,
        validate=validate.Range(min=0),
    )
    color = fields.String(
        required=False,
        allow_none=True,
        validate=validate.OneOf(COLUMN_COLORS),
    )
    is_done = StrictBoolean(required=False)

    def load(self, data, **kwargs):
        result = super().load(data, **kwargs)
        if "name" in result:
            result["name"] = result["name"].strip()
            if not result["name"]:
                raise ValidationError({"name": ["Name must not be blank."]})
        return result


class ReorderColumnsSchema(Schema):
    """Accepts an ordered list of column UUIDs.

    The position of each UUID in the list determines its new ``position``
    value (0-based).  The service derives ``{id: position}`` pairs from the
    index, so callers never need to supply explicit position integers.

    Body: ``{ "ordered_ids": ["<uuid>", "<uuid>", ...] }``
    """

    ordered_ids = fields.List(
        fields.UUID(),
        required=True,
        validate=validate.Length(min=1),
    )


def column_to_dict(col: BoardColumn) -> dict:
    """Serialise a BoardColumn to a safe, API-facing dictionary."""
    return {
        "id": str(col.id),
        "board_id": str(col.board_id),
        "name": col.name,
        "position": col.position,
        "color": col.color,
        "is_done": col.is_done,
        "created_at": col.created_at.isoformat(),
        "updated_at": col.updated_at.isoformat(),
    }
