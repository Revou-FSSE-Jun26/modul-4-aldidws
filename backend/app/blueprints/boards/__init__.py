"""Boards blueprint."""

from flask import Blueprint

boards_bp = Blueprint("boards", __name__)

from app.blueprints.boards import routes  # noqa: E402, F401
