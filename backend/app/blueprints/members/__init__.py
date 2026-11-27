"""Board-members blueprint.

Two blueprints live in this package:

- ``members_boards`` (url prefix ``/api/boards``): the board membership
  routes.
- ``members_cards`` (url prefix ``/api/v1/cards``): the card tag routes.

Keeping one package mirrors how ``cards`` and ``columns`` register the same
blueprint under two url prefixes in ``app/__init__.py``.
"""

from flask import Blueprint

members_boards = Blueprint("members_boards", __name__, url_prefix="/api/boards")
members_cards = Blueprint("members_cards", __name__, url_prefix="/api/v1/cards")

from app.blueprints.members import routes  # noqa: E402, F401
