"""
Cards service.

Contains the business logic for card operations.  Every function here MUST:

- Remain independent of Flask request and response objects.
- Raise typed ``AppException`` subclasses for expected failures.
- Enforce ownership before returning or mutating data.
"""

import uuid

from sqlalchemy import func

from app.common.exceptions import CardNotFoundException, ColumnNotFoundException
from app.extensions import db
from app.models.board import Board
from app.models.board_column import BoardColumn
from app.models.card import Card


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------


def _get_owned_card(current_user, card_id: uuid.UUID) -> Card:
    """Return the card whose board is owned by *current_user*, or raise 404.

    Joins Card → BoardColumn → Board so that the ownership check is a single
    query and no card is returned for a board the caller does not own.
    """
    card = db.session.execute(
        db.select(Card)
        .join(Card.column)
        .join(BoardColumn.board)
        .where(Card.id == card_id)
        .where(Board.owner_id == current_user.id)
    ).scalar_one_or_none()

    if card is None:
        raise CardNotFoundException()

    return card


def _get_owned_column(current_user, column_id: uuid.UUID) -> BoardColumn:
    """Return the column whose board is owned by *current_user*, or raise 404."""
    col = db.session.execute(
        db.select(BoardColumn)
        .join(BoardColumn.board)
        .where(BoardColumn.id == column_id)
        .where(Board.owner_id == current_user.id)
    ).scalar_one_or_none()

    if col is None:
        raise ColumnNotFoundException()

    return col


def _renormalise_positions(column_id: uuid.UUID) -> None:
    """Reassign 0-based contiguous order values to all cards in *column_id*.

    Ordered by current order first, then by creation time as a stable
    tiebreaker.  Does NOT commit — the caller owns the transaction boundary.
    """
    cards = db.session.execute(
        db.select(Card)
        .where(Card.column_id == column_id)
        .order_by(Card.order.asc(), Card.created_at.asc())
    ).scalars().all()

    for idx, c in enumerate(cards):
        c.order = idx


# ---------------------------------------------------------------------------
# Public service functions
# ---------------------------------------------------------------------------


def create_card(current_user, column_id: uuid.UUID, data: dict) -> Card:
    """Create a new card in *column_id* owned by *current_user*.

    Args:
        current_user: The authenticated user creating the card.
        column_id: UUID of the target column.
        data: Validated request data from ``CreateCardSchema``.

    Returns:
        The newly created ``Card`` instance.

    Raises:
        ColumnNotFoundException: When the column does not exist or its board
            is not owned by *current_user*.
    """
    _get_owned_column(current_user, column_id)

    max_pos = db.session.execute(
        db.select(func.max(Card.order)).where(Card.column_id == column_id)
    ).scalar()

    order = 0.0 if max_pos is None else max_pos + 1.0

    card = Card(
        column_id=column_id,
        owner_id=current_user.id,
        title=data["title"],
        description=data.get("description", ""),
        order=order,
        # priority and status are intentionally omitted — the Card model does
        # not yet have those columns.
    )

    try:
        db.session.add(card)
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise

    return card


def update_card(current_user, card_id: uuid.UUID, data: dict) -> Card:
    """Partially update a card owned by *current_user*.

    Args:
        current_user: The authenticated user requesting the update.
        card_id: UUID of the card to update.
        data: Validated request data from ``UpdateCardSchema`` (partial).

    Returns:
        The updated ``Card`` instance.

    Raises:
        CardNotFoundException: When the card does not exist or its board is
            not owned by *current_user*.
    """
    card = _get_owned_card(current_user, card_id)

    if "title" in data:
        card.title = data["title"]
    if "description" in data:
        card.description = data["description"]
    # priority and status are silently ignored until the model gains those
    # columns; the schema already validates the values so the API contract
    # is forward-compatible.

    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise

    return card


def delete_card(current_user, card_id: uuid.UUID) -> None:
    """Delete a card owned by *current_user*.

    Args:
        current_user: The authenticated user requesting the deletion.
        card_id: UUID of the card to delete.

    Raises:
        CardNotFoundException: When the card does not exist or its board is
            not owned by *current_user*.
    """
    card = _get_owned_card(current_user, card_id)

    try:
        db.session.delete(card)
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise


def move_card(
    current_user,
    card_id: uuid.UUID,
    column_id: uuid.UUID,
    order: float,
) -> Card:
    """Move a card to a new column and/or order, then renormalise.

    Both the source and destination columns must belong to boards owned by
    *current_user*.  Order values in both the source and destination columns
    are renormalised so that all cards remain contiguously zero-based after
    the move.

    Args:
        current_user: The authenticated user requesting the move.
        card_id: UUID of the card to move.
        column_id: UUID of the destination column.
        order: Desired zero-based order value within the destination column.

    Returns:
        The updated ``Card`` instance (refreshed from the database).

    Raises:
        CardNotFoundException: When the card does not exist or its board is
            not owned by *current_user*.
        ColumnNotFoundException: When the destination column does not exist
            or its board is not owned by *current_user*.
    """
    card = _get_owned_card(current_user, card_id)

    # Verify the destination column is accessible to the caller.
    _get_owned_column(current_user, column_id)

    old_column_id = card.column_id

    card.column_id = column_id
    card.order = order

    # Flush so the ORM reflects the new column before renormalisation queries.
    db.session.flush()

    _renormalise_positions(column_id)

    if old_column_id != column_id:
        _renormalise_positions(old_column_id)

    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise

    # Reload to pick up the DB-generated updated_at timestamp.
    db.session.refresh(card)

    return card
