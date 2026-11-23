"""Comments blueprint."""

from flask import Blueprint

comments_bp = Blueprint("comments", __name__)

from app.blueprints.comments import routes  # noqa: E402, F401  — registers routes
