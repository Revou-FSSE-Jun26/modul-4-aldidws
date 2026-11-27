"""
Cards service.

Contains the business logic for card operations.  Every function here MUST:

- Remain independent of Flask request and response objects.
- Raise typed ``AppException`` subclasses for expected failures.
- Enforce ownership before returning or mutating data.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import func, or_
from sqlalchemy.orm import selectinload

from app.access import (
    get_card_for_user,
    get_column_for_user,
)
from app.blueprints.notifications.service import notify_card_moved
from app.common.exceptions import CardNotFoundException, ColumnNotFoundException
from app.extensions import db
from app.models.board import Board
from app.models.board_column import BoardColumn
from app.models.board_member import BoardMember
from app.models.card import Card


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------


def _not_deleted():
    """Shared filter that excludes soft-deleted cards."""
    return Card.deleted_at.is_(None)


def _get_owned_card(current_user, card_id: uuid.UUID) -> Card:
    """Return a live card the caller may *write* to, or raise 404.

    Write access means the caller is the card's creator or the board owner;
    every other caller (including non-members and plain members without the
    card's tag/creation) receives the same non-disclosing 404.
    """
    return get_card_for_user(current_user, card_id, write=True)


def get_owned_card(current_user, card_id: uuid.UUID) -> Card:
    """Public wrapper: a live card the caller may read, or raise 404.

    Kept for backward compatibility with service modules (e.g. labels) that
    still import this name.
    """
    return get_card_for_user(current_user, card_id)


def _get_owned_column(current_user, column_id: uuid.UUID) -> BoardColumn:
    """Return a column the caller may *write* to, or raise 404.

    Card creation is open to every board member (the user can always create
    a task for themselves to work on); a non-member receives the same
    non-disclosing 404.
    """
    return get_column_for_user(current_user, column_id)


def _renormalise_positions(column_id: uuid.UUID, first_id: uuid.UUID | None = None) -> None:
    """Reassign 0-based contiguous order values to all cards in *column_id*.

    Ordered by current order first, then by creation time as a stable
    tiebreaker.  Does NOT commit — the caller owns the transaction boundary.
    """
    cards = db.session.execute(
        db.select(Card)
        .where(Card.column_id == column_id)
        .where(_not_deleted())
        .order_by(Card.order.asc(), Card.created_at.asc())
    ).scalars().all()

    # When order values tie, the card being moved (first_id) wins.
    cards.sort(key=lambda c: (c.order, 0 if c.id == first_id else 1))

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
        ColumnNotFoundException: When the column does not exist or the caller
            is not a member of its board (non-disclosing 404).
    """
    _get_owned_column(current_user, column_id)

    if data.get("position") == "top":
        min_pos = db.session.execute(
            db.select(func.min(Card.order))
            .where(Card.column_id == column_id)
            .where(_not_deleted())
        ).scalar()
        if min_pos is None:
            order = 0.0
        elif min_pos >= 1.0:
            order = min_pos - 1.0
        else:
            # cards.order has a non-negative check constraint, so make room
            # at the front by shifting the live cards down by one.
            db.session.execute(
                db.update(Card)
                .where(Card.column_id == column_id)
                .where(_not_deleted())
                .values(order=Card.order + 1.0)
            )
            order = min_pos
    else:
        max_pos = db.session.execute(
            db.select(func.max(Card.order))
            .where(Card.column_id == column_id)
            .where(_not_deleted())
        ).scalar()
        order = 0.0 if max_pos is None else max_pos + 1.0

    card = Card(
        column_id=column_id,
        owner_id=current_user.id,
        title=data["title"],
        description=data.get("description", ""),
        order=order,
        due_date=data.get("due_date"),
        priority=data.get("priority"),  # None when omitted (no priority)
    )

    try:
        db.session.add(card)
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise

    return card


def update_card(current_user, card_id: uuid.UUID, data: dict) -> Card:
    """Partially update a card the caller may *write* to.

    Write access: card creator OR board owner.  A plain member without the
    card's tag/creation receives a non-disclosing 404.
    """
    card = _get_owned_card(current_user, card_id)

    if "title" in data:
        card.title = data["title"]
    if "description" in data:
        card.description = data["description"]
    if "due_date" in data:
        # Omitted keeps the stored value; an explicit null clears it.
        card.due_date = data["due_date"]
    if "priority" in data:
        # Omitted keeps the stored value; an explicit null clears it.
        card.priority = data["priority"]

    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise

    return card


def delete_card(current_user, card_id: uuid.UUID) -> None:
    """Soft-delete a card the caller may *write* to (sets ``deleted_at``).

    The board owner may delete any card on their board; a plain member may
    delete only their own or a tagged card.
    """
    card = _get_owned_card(current_user, card_id)

    try:
        card.deleted_at = datetime.now(timezone.utc)
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

    Move rule: the caller must be the board owner, the card's creator, or
    tagged on the card.  The destination column must live on a board the
    caller can access.  Order values in both columns are renormalised so
    they remain contiguous and zero-based after the move.

    A notification is staged for every other board member (the mover is
    excluded) so teammates see what changed; the mover is not notified
    about their own action.

    Args:
        current_user: The authenticated user requesting the move.
        card_id: UUID of the card to move.
        column_id: UUID of the destination column.
        order: Desired zero-based order value within the destination column.

    Returns:
        The updated ``Card`` instance (refreshed from the database).

    Raises:
        CardNotFoundException: When the card does not exist, the caller is
            not a member of its board, or the move rule is not met.
        ColumnNotFoundException: When the destination column does not exist
            or the caller is not a member of its board.
    """
    # Move rule: board owner OR card creator OR tagged on the card.
    card = get_card_for_user(current_user, card_id, move=True)

    # The destination column must live on a board the caller can access.
    dest_col = get_column_for_user(current_user, column_id)

    old_column_id = card.column_id

    card.column_id = dest_col.id
    card.order = order

    # Flush so the ORM reflects the new column before renormalisation queries.
    db.session.flush()

    _renormalise_positions(dest_col.id, first_id=card.id)

    if old_column_id != dest_col.id:
        _renormalise_positions(old_column_id)

    try:
        notify_card_moved(dest_col.board_id, card, current_user)
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise

    # Reload to pick up the DB-generated updated_at timestamp.
    db.session.refresh(card)

    return card


def _accessible_boards_clause(user):
    """SQL condition: the board is one the user owns or is a member of."""
    return or_(
        Board.owner_id == user.id,
        Board.id.in_(
            db.select(BoardMember.board_id).where(BoardMember.user_id == user.id)
        ),
    )


def list_cards(current_user, filters: dict):
    """Return a page of live cards on boards *current_user* can access.

    Args:
        current_user: The authenticated user.
        filters: Validated data from ``CardListQuerySchema`` (search, board_id,
            mine, page, per_page).

    Returns:
        Tuple of (rows, total). Each row is a tuple of
        (Card, column_name, board_id, board_name).
    """
    # _accessible_boards_clause returns a single clause; _not_deleted() does too.
    # A plain list of clauses is what SQLAlchemy's .where() expects when unpacked.
    conditions = [_accessible_boards_clause(current_user), _not_deleted()]

    if filters.get("board_id") is not None:
        conditions.append(Board.id == filters["board_id"])
    if filters.get("mine"):
        conditions.append(Card.owner_id == current_user.id)
    term = filters.get("search")
    if term:
        conditions.append(
            or_(
                Card.title.icontains(term, autoescape=True),
                Card.description.icontains(term, autoescape=True),
            )
        )

    total = db.session.execute(
        db.select(func.count())
        .select_from(Card)
        .join(Card.column)
        .join(BoardColumn.board)
        .where(*conditions)
    ).scalar() or 0

    page = filters.get("page", 1)
    per_page = filters.get("per_page", 20)
    rows = db.session.execute(
        db.select(Card, BoardColumn.name, Board.id, Board.name)
        .options(selectinload(Card.labels))
        .join(Card.column)
        .join(BoardColumn.board)
        .where(*conditions)
        .order_by(
            Board.name.asc(),
            BoardColumn.position.asc(),
            Card.order.asc(),
            Card.id.asc(),
        )
        .limit(per_page)
        .offset((page - 1) * per_page)
    ).all()

    # Batch-load assignee IDs for all cards on this page (avoids N+1).
    card_ids = [r[0].id for r in rows]
    assignee_map: dict[uuid.UUID, list[str]] = {}
    if card_ids:
        from app.models.card_assignee import CardAssignee

        assignee_rows = db.session.execute(
            db.select(CardAssignee.card_id, CardAssignee.user_id).where(
                CardAssignee.card_id.in_(card_ids)
            )
        ).all()
        for card_id, user_id in assignee_rows:
            assignee_map.setdefault(card_id, []).append(str(user_id))

    return [
        (
            card,
            column_name,
            board_id,
            board_name,
            assignee_map.get(card.id, []),
        )
        for (card, column_name, board_id, board_name) in rows
    ], total
