"""Auth request schemas."""

import re

from marshmallow import Schema, fields, validate

_PASSWORD_RE = re.compile(r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$")


class RegisterSchema(Schema):
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
