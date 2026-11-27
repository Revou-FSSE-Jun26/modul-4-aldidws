"""Analytics service."""

import uuid

from sqlalchemy import func

from app.access import get_board_for_user
from app.common.exceptions import BoardNotFoundException
from app.extensions import db
from app.models.board import Board
from app.models.board_column import BoardColumn
from app.models.card import Card


def board_summary(current_user, board_id: uuid.UUID) -> dict:
    """Return aggregate card counts for *board_id*, which the caller can access.

    Raises:
        BoardNotFoundException: When the board does not exist or the caller is
            not a member (non-disclosing 404).
    """
    board = get_board_for_user(current_user, board_id)

    total = db.session.execute(
        db.select(func.count(Card.id))
        .join(Card.column)
        .where(
            BoardColumn.board_id == board_id,
            Card.deleted_at == None,  # noqa: E711 — SQLAlchemy requires == None for IS NULL
        )
    ).scalar() or 0

    # completed_cards is 0 until Card gains a status/done column.
    # Soft-deleted cards (deleted_at IS NOT NULL) signal removal, not
    # completion; equating the two would produce misleading counts.
    completed = 0

    return {
        "board_id": board_id,
        "total_cards": total,
        "completed_cards": completed,
    }
