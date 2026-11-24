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


def _author_name(comment: CardComment) -> str:
    """Return the author's name, or the part of their email before ``@``."""
    author = comment.author
    if author.name:
        return author.name
    return author.email.split("@", 1)[0]


def comment_to_dict(comment: CardComment) -> dict:
    """Serialise a CardComment to a safe, API-facing dictionary."""
    return {
        "id": str(comment.id),
        "card_id": str(comment.card_id),
        "author_id": str(comment.author_id),
        "author_name": _author_name(comment),
        "body": comment.body,
        "created_at": comment.created_at.isoformat(),
        "updated_at": comment.updated_at.isoformat(),
    }
