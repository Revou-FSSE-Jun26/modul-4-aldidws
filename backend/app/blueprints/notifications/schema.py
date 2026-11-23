"""Notifications schemas and serialization."""

from marshmallow import Schema, fields, validate

from app.models.notification import Notification


class CreateNotificationSchema(Schema):
    title = fields.String(required=True, validate=validate.Length(min=1, max=255))
    body = fields.String(load_default=None, validate=validate.Length(max=2000))


class UpdateNotificationSchema(Schema):
    is_read = fields.Boolean(required=False)


def notification_to_dict(n: Notification) -> dict:
    return n.to_dict()
