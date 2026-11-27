"""Labels blueprint."""
from flask import Blueprint

labels_bp = Blueprint("labels", __name__)

from app.blueprints.labels import routes  # noqa: E402, F401  - registers routes
