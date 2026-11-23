# Import all models here so that Flask-Migrate / Alembic autogenerate can
# detect every table when it inspects the metadata.  The order matters:
# parent models must be imported before child models that reference them,
# matching the foreign-key dependency chain.

from app.models.user import User  # noqa: F401
from app.models.board import Board  # noqa: F401
from app.models.board_column import BoardColumn  # noqa: F401
from app.models.card import Card  # noqa: F401
from app.models.card_comment import CardComment  # noqa: F401
from app.models.refresh_token import RefreshToken  # noqa: F401
from app.models.notification import Notification  # noqa: F401
