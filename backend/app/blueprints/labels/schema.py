"""Labels request schemas and serialization helpers."""
from marshmallow import Schema, ValidationError, fields, validate, validates_schema

from app.blueprints.cards.schema import sort_labels  # noqa: F401  (re-exported)
from app.models.label import LABEL_COLORS, Label

_NAME_BLANK = "Name must not be blank."


def _strip_name(result: dict) -> None:
    if "name" in result:
        result["name"] = result["name"].strip()
        if not result["name"]:
            raise ValidationError({"name": [_NAME_BLANK]})


class CreateLabelSchema(Schema):
    name = fields.String(required=True, validate=validate.Length(min=1, max=100))
    color = fields.String(required=True, validate=validate.OneOf(LABEL_COLORS))

    def load(self, data, **kwargs):
        result = super().load(data, **kwargs)
        _strip_name(result)
        if len(result["name"]) > 50:
            raise ValidationError({"name": ["Name must be at most 50 characters."]})
        return result


class UpdateLabelSchema(Schema):
    name = fields.String(required=False, validate=validate.Length(min=1, max=100))
    color = fields.String(required=False, validate=validate.OneOf(LABEL_COLORS))

    def load(self, data, **kwargs):
        result = super().load(data, **kwargs)
        _strip_name(result)
        if "name" in result and len(result["name"]) > 50:
            raise ValidationError({"name": ["Name must be at most 50 characters."]})
        if not result:
            raise ValidationError({"_schema": ["Provide at least one of name or color."]})
        return result


class SetCardLabelsSchema(Schema):
    label_ids = fields.List(
        fields.UUID(),
        required=True,
        validate=validate.Length(max=20),
    )

    @validates_schema
    def _no_duplicates(self, data, **kwargs):
        ids = data.get("label_ids")
        if ids is not None and len(set(ids)) != len(ids):
            raise ValidationError({"label_ids": ["Duplicate label ids are not allowed."]})


def label_to_dict(label: Label) -> dict:
    """Serialise a Label to its API shape."""
    return {
        "id": str(label.id),
        "board_id": str(label.board_id),
        "name": label.name,
        "color": label.color,
        "created_at": label.created_at.isoformat(),
        "updated_at": label.updated_at.isoformat(),
    }
