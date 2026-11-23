"""Auth request schemas."""

import re

from marshmallow import Schema, fields, pre_load, validate

_PASSWORD_RE = re.compile(r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$")


class RegisterSchema(Schema):
    name = fields.String(required=True, validate=validate.Length(min=1, max=255))
    email = fields.Email(required=True)
    password = fields.String(
        required=True,
        validate=[
            validate.Length(min=8),
            validate.Regexp(
                _PASSWORD_RE,
                error="Password must contain at least one uppercase letter, one lowercase letter, and one digit.",
            ),
        ],
    )

    @pre_load
    def strip_name(self, data, **kwargs):
        # Strip surrounding whitespace so a whitespace-only name fails Length(min=1).
        if isinstance(data, dict) and isinstance(data.get("name"), str):
            data = {**data, "name": data["name"].strip()}
        return data


class LoginSchema(Schema):
    email = fields.Email(required=True)
    password = fields.String(
        required=True,
        validate=[
            validate.Length(min=8),
            validate.Regexp(
                _PASSWORD_RE,
                error="Password must contain at least one uppercase letter, one lowercase letter, and one digit.",
            ),
        ],
    )
