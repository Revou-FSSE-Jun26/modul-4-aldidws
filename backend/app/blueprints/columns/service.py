"""
Columns service.

Contains the business logic for column operations.  Every function here MUST:

- Remain independent of Flask request and response objects.
- Raise typed ``AppException`` subclasses for expected failures.
- Enforce ownership before returning or mutating data.
"""

import uuid

from sqlalchemy import func

from app.access import get_board_for_user, get_column_for_user
from app.common.exceptions import (
    BoardNotFoundException,
    ColumnNotFoundException,
    ResourceConflictException,
    ValidationException,
)
from app.extensions import db
from app.models.board import Board
from app.models.board_column import BoardColumn
from app.models.card import Card


# ---------------------------------------------------------------------------
# Private helpers — delegate to the shared access layer
# ---------------------------------------------------------------------------


def _get_owned_board(board_id: uuid.UUID, current_user) -> Board:
    """Return the board the caller may *write* to (owner only), or raise 404.

    Column create/delete/reorder stay owner-only; a plain member receives the
    same non-disclosing 404 as an unknown board.
    """
    return get_board_for_user(current_user, board_id, write=True)


def _get_owned_column(column_id: uuid.UUID, current_user) -> BoardColumn:
    """Return the column the caller may *write* to (board owner only), or 404."""
    return get_column_for_user(current_user, column_id, write=True)


def _renormalise_column_positions(board_id: uuid.UUID) -> None:
    """Reassign 0-based contiguous positions to all columns in *board_id*.

    Ordered by current position first, then by creation time as a stable
    tiebreaker.  Does NOT commit — the caller owns the transaction boundary.
    """
    columns = db.session.execute(
        db.select(BoardColumn)
        .where(BoardColumn.board_id == board_id)
        .order_by(BoardColumn.position.asc(), BoardColumn.created_at.asc())
    ).scalars().all()

    for idx, col in enumerate(columns):
        col.position = idx


# ---------------------------------------------------------------------------
# Public service functions
# ---------------------------------------------------------------------------


def create_column(current_user, board_id: uuid.UUID, data: dict) -> BoardColumn:
    """Create a new column in the board owned by *current_user*.

    Args:
        current_user: The authenticated user creating the column.
        board_id: UUID of the target board.
        data: Validated request data from ``CreateColumnSchema``.

    Returns:
        The newly created ``BoardColumn`` instance.

    Raises:
        BoardNotFoundException: When the board does not exist or is not
            owned by *current_user*.
    """
    _get_owned_board(board_id, current_user)

    if data.get("position") is None:
        max_pos = db.session.execute(
            db.select(func.max(BoardColumn.position)).where(
                BoardColumn.board_id == board_id
            )
        ).scalar()
        position = 0 if max_pos is None else max_pos + 1
    else:
        position = data["position"]

    col = BoardColumn(
        board_id=board_id,
        name=data["name"],
        position=position,
        color=data.get("color"),
        is_done=data.get("is_done", False),
    )

    try:
        db.session.add(col)
        db.session.flush()
        _renormalise_column_positions(board_id)
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise

    db.session.refresh(col)
    return col


def update_column(current_user, column_id: uuid.UUID, data: dict) -> BoardColumn:
    """Partially update a column owned by *current_user*.

    Args:
        current_user: The authenticated user requesting the update.
        column_id: UUID of the column to update.
        data: Validated request data from ``UpdateColumnSchema`` (partial).

    Returns:
        The updated ``BoardColumn`` instance.

    Raises:
        ColumnNotFoundException: When the column does not exist or its board
            is not owned by *current_user*.
    """
    col = _get_owned_column(column_id, current_user)

    if "name" in data:
        col.name = data["name"]
    if "position" in data:
        col.position = data["position"]
    if "color" in data:
        col.color = data["color"]
    if "is_done" in data:
        col.is_done = data["is_done"]

    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise

    return col


def delete_column(current_user, column_id: uuid.UUID) -> None:
    """Delete a column and let the database cascade-delete its child cards.

    The ``BoardColumn`` model defines ``cards`` with ``passive_deletes=True``
    and ``Card.column_id`` uses ``ondelete="CASCADE"``, so the database
    handles physical deletion of child cards when the column row is deleted.
    A single ORM delete is sufficient and atomic.

    Args:
        current_user: The authenticated user requesting the deletion.
        column_id: UUID of the column to delete.

    Raises:
        ColumnNotFoundException: When the column does not exist or its board
            is not owned by *current_user*.
        ResourceConflictException: When the column still has non-deleted cards.
    """
    col = _get_owned_column(column_id, current_user)
    board_id = col.board_id

    live_cards = db.session.execute(
        db.select(func.count(Card.id)).where(
            Card.column_id == col.id,
            Card.deleted_at.is_(None),
        )
    ).scalar() or 0
    if live_cards > 0:
        raise ResourceConflictException(
            message="This column still has cards. Move or delete them first."
        )

    try:
        db.session.delete(col)
        db.session.flush()
        _renormalise_column_positions(board_id)
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise


def reorder(
    board_id: uuid.UUID,
    user_id: uuid.UUID,
    ordered_ids: list[uuid.UUID],
) -> list[BoardColumn]:
    """Reorder columns by assigning positions derived from list index.

    ``ordered_ids`` is an ordered sequence of column UUIDs; each column
    receives a 0-based position equal to its index in the list.  All
    referenced columns must belong to *board_id*.

    After bulk-assignment, ``_renormalise_column_positions`` fills any gaps
    so positions are always contiguous.

    Args:
        board_id: UUID of the board whose columns are being reordered.
        user_id: ID of the authenticated user — used to verify board ownership.
        ordered_ids: Ordered list of column UUIDs (index → new position).

    Returns:
        All columns for the board ordered by position after the update.

    Raises:
        BoardNotFoundException: When the board does not exist or is not
            owned by the user.
        ColumnNotFoundException: When any UUID references a column that does
            not exist or does not belong to the specified board.
    """
    # Reuse the existing ownership helper — build a temporary user-like object
    # from user_id so we don't need to re-query the User table.  The access
    # layer only ever reads ``.id``, so the shim is sufficient.
    class _User:
        id = user_id

    _get_owned_board(board_id, _User())

    board_column_ids = set(
        db.session.execute(
            db.select(BoardColumn.id).where(BoardColumn.board_id == board_id)
        ).scalars()
    )
    if not set(ordered_ids) <= board_column_ids:
        raise ColumnNotFoundException()
    if len(ordered_ids) != len(set(ordered_ids)) or set(ordered_ids) != board_column_ids:
        raise ValidationException(
            "ordered_ids must list every column of the board exactly once."
        )

    for position, column_id in enumerate(ordered_ids):
        col = db.session.execute(
            db.select(BoardColumn).where(
                BoardColumn.id == column_id,
                BoardColumn.board_id == board_id,
            )
        ).scalar_one_or_none()

        if col is None:
            raise ColumnNotFoundException()

        col.position = position

    try:
        db.session.flush()
        _renormalise_column_positions(board_id)
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise

    columns = db.session.execute(
        db.select(BoardColumn)
        .where(BoardColumn.board_id == board_id)
        .order_by(BoardColumn.position.asc())
    ).scalars().all()

    return list(columns)
