"""Notifications route handlers."""

import uuid

from flask import jsonify, request

from app.blueprints.auth.decorators import token_required
from app.blueprints.notifications import notifications_bp
from app.blueprints.notifications import service
from app.blueprints.notifications.schema import notification_to_dict


@notifications_bp.route("", methods=["GET"])
@token_required
def list_notifications(current_user):
    """List notifications for the authenticated user.
    ---
    tags:
      - Notifications
    security:
      - BearerAuth: []
    parameters:
      - name: page
        in: query
        schema:
          type: integer
          default: 1
        description: Page number.
      - name: per_page
        in: query
        schema:
          type: integer
          default: 20
        description: Number of items per page (max 100).
    responses:
      200:
        description: Paginated list of notifications.
        content:
          application/json:
            schema:
              type: object
              properties:
                data:
                  type: array
                  items:
                    type: object
                meta:
                  type: object
                  properties:
                    page:
                      type: integer
                    per_page:
                      type: integer
                    total:
                      type: integer
    """
    page = request.args.get("page", 1, type=int)
    per_page = min(request.args.get("per_page", 20, type=int), 100)
    items, total = service.list_notifications(current_user, page=page, per_page=per_page)
    return jsonify({
        "data": [notification_to_dict(n) for n in items],
        "meta": {"page": page, "per_page": per_page, "total": total},
    }), 200


@notifications_bp.route("/<notification_id>/read", methods=["PATCH"])
@token_required
def mark_read(current_user, notification_id):
    """Mark a notification as read.
    ---
    tags:
      - Notifications
    security:
      - BearerAuth: []
    parameters:
      - name: notification_id
        in: path
        required: true
        schema:
          type: string
          format: uuid
    responses:
      200:
        description: Notification marked as read.
        content:
          application/json:
            schema:
              type: object
              properties:
                data:
                  type: object
      404:
        description: Notification not found.
    """
    n = service.mark_read(current_user, uuid.UUID(notification_id))
    return jsonify({"data": notification_to_dict(n)}), 200
