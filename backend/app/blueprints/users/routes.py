"""Users route handlers."""

from flask import jsonify, request

from app.blueprints.auth.decorators import token_required
from app.blueprints.users import users_bp
from app.blueprints.users import service
from app.blueprints.users.schema import UpdateUserSchema, user_to_dict


@users_bp.route("/me", methods=["GET"])
@token_required
def get_me(current_user):
    """Get the authenticated user's profile.
    ---
    tags:
      - Users
    security:
      - BearerAuth: []
    responses:
      200:
        description: User profile (password excluded).
        content:
          application/json:
            schema:
              type: object
              properties:
                data:
                  type: object
                  properties:
                    id:
                      type: string
                      format: uuid
                    email:
                      type: string
                    name:
                      type: string
                    timezone:
                      type: string
    """
    return jsonify({"data": user_to_dict(service.get_me(current_user))}), 200


@users_bp.route("/me", methods=["PATCH"])
@token_required
def update_me(current_user):
    """Update the authenticated user's profile.

    Password changes are not permitted through this endpoint.
    ---
    tags:
      - Users
    security:
      - BearerAuth: []
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            properties:
              name:
                type: string
                example: Alice Smith
              timezone:
                type: string
                example: Asia/Jakarta
    responses:
      200:
        description: Updated user profile.
        content:
          application/json:
            schema:
              type: object
              properties:
                data:
                  type: object
      400:
        description: Validation error.
    """
    data = UpdateUserSchema().load(request.get_json() or {}, partial=True)
    user = service.update_me(current_user, data)
    return jsonify({"data": user_to_dict(user)}), 200
