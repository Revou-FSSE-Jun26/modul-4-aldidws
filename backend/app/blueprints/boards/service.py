"""
Boards service.

Contains the business logic for board operations.  Every function here MUST:

- Remain independent of Flask request and response objects.
- Raise typed ``AppException`` subclasses for expected failures.
- Enforce ownership before returning or mutating data.
"""

import uuid

from sqlalchemy import func

from app.common.exceptions import BoardNotFoundException, ResourceConflictException
from app.extensions import db
from app.models.board import Board
from app.models.board_column import BoardColumn
from app.models.card import Card
from app.models.user import User


def _check_name_conflict(user: User, name: str, exclude_board_id=None) -> None:
    """Raise ``ResourceConflictException`` if *name* is already used by this user.

    The comparison is case-insensitive.  When *exclude_board_id* is given the
    board with that id is excluded from the check (used during PATCH).
    """
    query = db.select(Board).where(
        Board.owner_id == user.id,
        func.lower(Board.name) == name.lower(),
    )

    if exclude_board_id is not None:
        query = query.where(Board.id != exclude_board_id)

    conflict = db.session.execute(query).scalar_one_or_none()

    if conflict is not None:
        raise ResourceConflictException(
            message="A board with that name already exists."
        )


def _get_owned_board(user: User, board_id: uuid.UUID) -> Board:
    """Return the board owned by *user* with *board_id*, or raise 404."""
    board = db.session.execute(
        db.select(Board).where(
            Board.id == board_id,
            Board.owner_id == user.id,
        )
    ).scalar_one_or_none()

    if board is None:
        raise BoardNotFoundException()

    return board


def create_board(current_user: User, name: str) -> Board:
    """Create and persist a new board owned by *current_user*.

    Args:
        current_user: The authenticated user who will own the board.
        name: The display name for the new board (already stripped).

    Returns:
        The newly created ``Board`` instance.

    Raises:
        ResourceConflictException: When the user already owns a board with
            the same name (case-insensitive).
    """
    _check_name_conflict(current_user, name)

    board = Board(
        owner_id=current_user.id,
        name=name,
    )

    try:
        db.session.add(board)
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise

    return board


def list_boards(current_user: User) -> list[Board]:
    """Return all boards owned by *current_user*.

    Args:
        current_user: The authenticated user whose boards are listed.

    Returns:
        A list of ``Board`` instances, ordered by creation time ascending.
    """
    boards = db.session.execute(
        db.select(Board)
        .where(Board.owner_id == current_user.id)
        .order_by(Board.created_at.asc())
    ).scalars().all()

    return list(boards)


def get_board(current_user: User, board_id: uuid.UUID) -> Board:
    """Return a single board that exists and is owned by *current_user*.

    Args:
        current_user: The authenticated user requesting the board.
        board_id: The UUID primary key of the board.

    Returns:
        The matching ``Board`` instance.

    Raises:
        BoardNotFoundException: When the board does not exist or is not
            owned by *current_user* (non-disclosing 404).
    """
    return _get_owned_board(current_user, board_id)


def get_board_detail(current_user: User, board_id: uuid.UUID):
    """Return a board with its columns and live cards (three queries).

    Returns:
        Tuple ``(board, columns, cards_by_column)`` where ``cards_by_column``
        maps column id to its non-deleted cards ordered by ``order``.

    Raises:
        BoardNotFoundException: When the board does not exist or is not owned
            by *current_user*.
    """
    board = _get_owned_board(current_user, board_id)

    columns = list(
        db.session.execute(
            db.select(BoardColumn)
            .where(BoardColumn.board_id == board.id)
            .order_by(BoardColumn.position.asc(), BoardColumn.created_at.asc())
        ).scalars().all()
    )

    cards_by_column: dict = {col.id: [] for col in columns}
    if columns:
        cards = db.session.execute(
            db.select(Card)
            .where(
                Card.column_id.in_(list(cards_by_column)),
                Card.deleted_at.is_(None),
            )
            .order_by(Card.order.asc(), Card.created_at.asc(), Card.id.asc())
        ).scalars().all()
        for card in cards:
            cards_by_column[card.column_id].append(card)

    return board, columns, cards_by_column


def update_board(current_user: User, board_id: uuid.UUID, data: dict) -> Board:
    """Partially update a board owned by *current_user*.

    Args:
        current_user: The authenticated user requesting the update.
        board_id: The UUID primary key of the board to update.
        data: A dictionary of fields to update.  Only ``name`` is
            supported; unknown keys are ignored.

    Returns:
        The updated ``Board`` instance.

    Raises:
        BoardNotFoundException: When the board does not exist or is not
            owned by *current_user*.
        ResourceConflictException: When the new name conflicts with
            another board owned by *current_user* (case-insensitive).
    """
    board = _get_owned_board(current_user, board_id)

    if "name" in data:
        new_name = data["name"]
        if new_name.lower() != board.name.lower():
            _check_name_conflict(current_user, new_name, exclude_board_id=board.id)
        board.name = new_name

    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise

    return board


def delete_board(current_user: User, board_id: uuid.UUID) -> None:
    """Delete a board and all its child records.

    The ``Board`` model uses ``passive_deletes=True`` on its ``columns``
    relationship, delegating physical deletion of child ``BoardColumn`` rows
    (and, through their own CASCADE, ``Card`` rows) to the database.
    Deleting the ``Board`` row in a single commit is therefore sufficient and
    atomic.

    Args:
        current_user: The authenticated user requesting the deletion.
        board_id: The UUID primary key of the board to delete.

    Raises:
        BoardNotFoundException: When the board does not exist or is not
            owned by *current_user*.
    """
    board = _get_owned_board(current_user, board_id)

    try:
        db.session.delete(board)
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise
