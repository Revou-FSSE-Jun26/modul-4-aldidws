"""Columns blueprint."""

from flask import Blueprint

columns_bp = Blueprint("columns", __name__)

from app.blueprints.columns import routes  # noqa: E402, F401  — registers routes
