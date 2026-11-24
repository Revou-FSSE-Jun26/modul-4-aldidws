"""Auth route handlers."""

from flask import jsonify, request

from app.blueprints.auth import auth_bp
from app.blueprints.auth import service
from app.blueprints.auth.schema import LoginSchema, RegisterSchema


@auth_bp.route("/register", methods=["POST"])
def register():
    """Register a new user account.
    ---
    tags:
      - Auth
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            required:
              - name
              - email
              - password
            properties:
              name:
                type: string
                example: Alice
              email:
                type: string
                format: email
                example: alice@example.com
              password:
                type: string
                format: password
                example: "s3cr3tP@ss"
    responses:
      201:
        description: User created successfully.
        content:
          application/json:
            schema:
              type: object
              properties:
                data:
                  type: object
      400:
        description: Validation error.
      409:
        description: Email already in use.
    """
    data = RegisterSchema().load(request.get_json())
    user = service.register_user(
        data["email"], data["password"], data["name"]
    )
    return jsonify({"data": user.to_dict()}), 201


@auth_bp.route("/login", methods=["POST"])
def login():
    """Authenticate and obtain JWT tokens.
    ---
    tags:
      - Auth
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            required:
              - email
              - password
            properties:
              email:
                type: string
                format: email
                example: alice@example.com
              password:
                type: string
                format: password
                example: "s3cr3tP@ss"
    responses:
      200:
        description: Login successful. Returns access token, refresh token, and user info.
        content:
          application/json:
            schema:
              type: object
              properties:
                data:
                  type: object
                  properties:
                    access_token:
                      type: string
                    refresh_token:
                      type: string
                    user:
                      type: object
      401:
        description: Invalid credentials.
    """
    data = LoginSchema().load(request.get_json())
    user, access_token, raw_refresh_token = service.login_user(
        data["email"], data["password"]
    )
    return (
        jsonify(
            {
                "data": {
                    "access_token": access_token,
                    "refresh_token": raw_refresh_token,
                    "user": {
                        "id": str(user.id),
                        "email": user.email,
                        "name": user.name,
                        "role": user.role,
                        "timezone": user.timezone,
                    },
                }
            }
        ),
        200,
    )
