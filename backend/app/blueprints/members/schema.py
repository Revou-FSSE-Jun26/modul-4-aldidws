"""Members request schemas."""

from marshmallow import Schema, fields, validate


class InviteMemberSchema(Schema):
    """Body for POST /api/boards/{board_id}/members."""

    email = fields.String(
        required=True,
        validate=validate.Email(),
    )

    def load(self, data, **kwargs):
        result = super().load(data, **kwargs)
        result["email"] = result["email"].strip().lower()
        if not result["email"]:
            from marshmallow import ValidationError

            raise ValidationError({"email": ["Email must not be blank."]})
        return result


class SetCardAssigneesSchema(Schema):
    """Body for PATCH /api/v1/cards/{card_id}/assignees."""

    user_ids = fields.List(
        fields.UUID(),
        required=False,
        load_default=[],
    )
