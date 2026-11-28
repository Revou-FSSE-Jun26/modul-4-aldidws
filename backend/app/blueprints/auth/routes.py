"""Auth route handlers."""

from flask import jsonify, make_response, request

from app.blueprints.auth import auth_bp
from app.blueprints.auth import service
from app.blueprints.auth.schema import LoginSchema, RegisterSchema

# Cookie configuration constants for the refresh token.
_REFRESH_COOKIE_NAME = "refresh_token"
_REFRESH_COOKIE_PATH = "/api/auth"
_REFRESH_COOKIE_MAX_AGE = 7 * 24 * 3600  # 7 days


def _set_refresh_cookie(response, raw_refresh_token: str) -> None:
    """Attach the HttpOnly refresh-token cookie to *response*."""
    response.set_cookie(
        _REFRESH_COOKIE_NAME,
        value=raw_refresh_token,
        httponly=True,
        secure=True,
        samesite="None",  # required for cross-origin Vercel→Railway
        max_age=_REFRESH_COOKIE_MAX_AGE,
        path=_REFRESH_COOKIE_PATH,
    )


def _clear_refresh_cookie(response) -> None:
    """Clear the refresh-token cookie on *response*."""
    response.set_cookie(
        _REFRESH_COOKIE_NAME,
        value="",
        httponly=True,
        secure=True,
        samesite="None",
        max_age=0,
        path=_REFRESH_COOKIE_PATH,
    )


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

    resp = make_response(
        jsonify(
            {
                "data": {
                    "access_token": access_token,
                    "refresh_token": raw_refresh_token,  # kept for backward compat
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
    _set_refresh_cookie(resp, raw_refresh_token)
    return resp


@auth_bp.route("/refresh", methods=["POST"])
def refresh():
    """Exchange a valid HttpOnly refresh-token cookie for a new access token.

    This endpoint is intentionally unauthenticated (no @token_required):
    its sole purpose is to restore a session when the access token is gone.
    ---
    tags:
      - Auth
    responses:
      200:
        description: New access token and user info.
      401:
        description: Missing, invalid, or expired refresh token.
    """
    raw_token = request.cookies.get(_REFRESH_COOKIE_NAME)

    if not raw_token:
        return (
            jsonify(
                {
                    "error": {
                        "code": "MISSING_REFRESH_TOKEN",
                        "message": "No refresh token",
                        "details": None,
                    }
                }
            ),
            401,
        )

    result = service.refresh_access_token(raw_token)
    return jsonify({"data": result}), 200


@auth_bp.route("/logout", methods=["POST"])
def logout():
    """Revoke the refresh token and clear the cookie.

    Intentionally unauthenticated — the user may be calling with an expired
    access token.  Idempotent: returns 204 regardless of whether a cookie
    was present.
    ---
    tags:
      - Auth
    responses:
      204:
        description: Logged out successfully.
    """
    raw_token = request.cookies.get(_REFRESH_COOKIE_NAME)

    if raw_token:
        service.revoke_refresh_token(raw_token)

    resp = make_response("", 204)
    _clear_refresh_cookie(resp)
    return resp
