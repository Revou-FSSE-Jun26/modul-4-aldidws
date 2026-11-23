"""Users request schemas and serialization."""

import zoneinfo

from marshmallow import Schema, ValidationError, fields, validate

from app.models.user import User

# Build the IANA set once at import time (cheap, ~600 names on CPython).
_IANA_TIMEZONES: frozenset[str] = frozenset(zoneinfo.available_timezones())


def _validate_iana_timezone(value: str) -> None:
    """Raise ValidationError if *value* is not a recognised IANA timezone name."""
    if value not in _IANA_TIMEZONES:
        raise ValidationError(
            f"'{value}' is not a valid IANA timezone. "
            "Use a name such as 'America/New_York' or 'UTC'."
        )


class UpdateUserSchema(Schema):
    name = fields.String(required=False, validate=validate.Length(max=255))
    timezone = fields.String(
        required=False,
        validate=[validate.Length(max=64), _validate_iana_timezone],
    )


def user_to_dict(user: User) -> dict:
    """Serialize a User to an API-safe dictionary.

    Delegates to User.to_dict() which already excludes password_hash.
    """
    return user.to_dict()
