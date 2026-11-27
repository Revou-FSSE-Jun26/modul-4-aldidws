"""Users route handlers."""

from flask import jsonify, request

from app.blueprints.auth.decorators import token_required
from app.blueprints.users import users_bp
from app.blueprints.users import service
from app.blueprints.users.schema import UpdateUserSchema, user_to_dict


@users_bp.route("/me", methods=["GET"])
@token_required
def get_me(current_user):
    """Get the authenticated user's profile."""
    return jsonify({"data": user_to_dict(service.get_me(current_user))}), 200


@users_bp.route("/me", methods=["PATCH"])
@token_required
def update_me(current_user):
    """Update the authenticated user's profile."""
    data = UpdateUserSchema().load(request.get_json() or {}, partial=True)
    user = service.update_me(current_user, data)
    return jsonify({"data": user_to_dict(user)}), 200


@users_bp.route("/me/summary", methods=["GET"])
@token_required
def get_workspace_summary(current_user):
    """Return workspace summary statistics for the authenticated user.
    ---
    tags:
      - Users
    security:
      - BearerAuth: []
    responses:
      200:
        description: Workspace summary.
        content:
          application/json:
            schema:
              type: object
              properties:
                data:
                  type: object
                  properties:
                    workspace_name:
                      type: string
                    projects:
                      type: integer
                    tasks:
                      type: integer
                    members:
                      type: integer
                meta:
                  nullable: true
    """
    summary = service.get_workspace_summary(current_user)
    return jsonify({"data": summary, "meta": None}), 200
