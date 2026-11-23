"""Comments request schemas and serialization helpers."""

from marshmallow import Schema, ValidationError, fields, validate

from app.models.card_comment import CardComment


class CreateCommentSchema(Schema):
    body = fields.String(
        required=True,
        validate=validate.Length(min=1, max=2000),
    )

    def load(self, data, **kwargs):
        result = super().load(data, **kwargs)
        result["body"] = result["body"].strip()
        if not result["body"]:
            raise ValidationError({"body": ["Body must not be blank."]})
        return result


class UpdateCommentSchema(Schema):
    body = fields.String(
        required=False,
        validate=validate.Length(min=1, max=2000),
    )

    def load(self, data, **kwargs):
        result = super().load(data, **kwargs)
        if "body" in result:
            result["body"] = result["body"].strip()
            if not result["body"]:
                raise ValidationError({"body": ["Body must not be blank."]})
        return result


def comment_to_dict(comment: CardComment) -> dict:
    """Serialise a CardComment to a safe, API-facing dictionary."""
    return {
        "id": str(comment.id),
        "card_id": str(comment.card_id),
        "author_id": str(comment.author_id),
        "body": comment.body,
        "created_at": comment.created_at.isoformat(),
        "updated_at": comment.updated_at.isoformat(),
    }
