"""
Auth decorators.

Provides the ``@token_required`` decorator for protecting route handlers
that require an authenticated user.
"""

import uuid
from functools import wraps

import jwt
from flask import current_app, g, jsonify, request

from app.extensions import db
from app.models.user import User


def token_required(f):
    """Verify a Bearer JWT and inject the authenticated user.

    On success, sets ``flask.g.current_user`` and passes the ``User``
    instance as the first positional argument to the wrapped function.

    On any failure (missing header, expired token, invalid token, unknown
    user) returns a 401 JSON response directly without raising an exception.
    """

    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")

        if not auth_header.startswith("Bearer "):
            return (
                jsonify(
                    {
                        "error": {
                            "code": "UNAUTHORIZED",
                            "message": "Authentication required.",
                            "details": None,
                        }
                    }
                ),
                401,
            )

        token = auth_header[len("Bearer "):]

        try:
            payload = jwt.decode(
                token,
                current_app.config["JWT_SECRET_KEY"],
                algorithms=["HS256"],
            )
        except jwt.ExpiredSignatureError:
            return (
                jsonify(
                    {
                        "error": {
                            "code": "UNAUTHORIZED",
                            "message": "Authentication required.",
                            "details": None,
                        }
                    }
                ),
                401,
            )
        except jwt.InvalidTokenError:
            return (
                jsonify(
                    {
                        "error": {
                            "code": "UNAUTHORIZED",
                            "message": "Authentication required.",
                            "details": None,
                        }
                    }
                ),
                401,
            )

        user = db.session.get(User, uuid.UUID(payload["sub"]))

        if user is None:
            return (
                jsonify(
                    {
                        "error": {
                            "code": "UNAUTHORIZED",
                            "message": "Authentication required.",
                            "details": None,
                        }
                    }
                ),
                401,
            )

        g.current_user = user

        return f(user, *args, **kwargs)

    return decorated
