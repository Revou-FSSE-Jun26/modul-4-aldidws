"""
Boards service.

Contains the business logic for board operations. Every function here MUST:

- Remain independent of Flask request and response objects.
- Raise typed ``AppException`` subclasses for expected failures.
- Enforce ownership before returning or mutating data.
"""

import uuid

from sqlalchemy import func
from sqlalchemy.orm import selectinload

from app.access import get_board_for_user
from app.common.exceptions import ResourceConflictException
from app.extensions import db
from app.models.board import Board
from app.models.board_column import BoardColumn
from app.models.board_member import BoardMember
from app.models.card import Card
from app.models.card_assignee import CardAssignee
from app.models.label import Label
from app.models.user import User


def _check_name_conflict(owner_id: uuid.UUID, name: str, exclude_board_id=None) -> None:
    """Raise ResourceConflictException if name is already used for this owner.

    The comparison is case-insensitive. When exclude_board_id is given,
    the board with that ID is excluded from the check.
    """
    query = db.select(Board).where(
        Board.owner_id == owner_id,
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
    """Return the board user may access, or raise a non-disclosing 404."""
    return get_board_for_user(user, board_id)


def create_board(current_user: User, name: str) -> Board:
    """Create and persist a new board owned by current_user.

    The owner's BoardMember row is created in the same transaction.
    """
    _check_name_conflict(current_user.id, name)

    board = Board(
        owner_id=current_user.id,
        name=name,
    )

    try:
        # Step 1: Add the board to the current transaction.
        db.session.add(board)

        # Step 2: Flush so SQLAlchemy generates board.id.
        # The board is inserted, but the transaction is not committed yet.
        db.session.flush()

        # Step 3: Create the owner's membership using the generated UUID.
        membership = BoardMember(
            board_id=board.id,
            user_id=current_user.id,
            role="owner",
        )

        db.session.add(membership)

        # Step 4: Commit the board and membership atomically.
        db.session.commit()

    except Exception:
        # Roll back both inserts if any operation fails.
        db.session.rollback()
        raise

    return board


def list_boards(current_user: User) -> tuple[list[Board], dict[uuid.UUID, str]]:
    """Return all boards accessible to the authenticated user and their roles."""

    accessible = {
        b.id
        for b in db.session.execute(
            db.select(Board).where(
                (Board.owner_id == current_user.id)
                | (
                    Board.id.in_(
                        db.select(BoardMember.board_id).where(
                            BoardMember.user_id == current_user.id
                        )
                    )
                )
            )
        ).scalars().all()
    }

    boards = list(
        db.session.execute(
            db.select(Board)
            .where(Board.id.in_(accessible))
            .order_by(Board.created_at.asc())
        ).scalars().all()
    )

    roles: dict[uuid.UUID, str] = {
        b.id: ("owner" if b.owner_id == current_user.id else "member")
        for b in boards
    }

    return boards, roles


def get_board(current_user: User, board_id: uuid.UUID) -> Board:
    """Return a single board accessible to the authenticated user."""
    return _get_owned_board(current_user, board_id)


def get_board_detail(current_user: User, board_id: uuid.UUID):
    """Return a board with columns, live cards, labels, members and permissions."""

    board = _get_owned_board(current_user, board_id)

    columns = list(
        db.session.execute(
            db.select(BoardColumn)
            .where(BoardColumn.board_id == board.id)
            .order_by(
                BoardColumn.position.asc(),
                BoardColumn.created_at.asc(),
            )
        ).scalars().all()
    )

    cards_by_column: dict = {col.id: [] for col in columns}
    all_cards: list[Card] = []

    if columns:
        cards = db.session.execute(
            db.select(Card)
            .options(selectinload(Card.labels))
            .where(
                Card.column_id.in_(list(cards_by_column)),
                Card.deleted_at.is_(None),
            )
            .order_by(
                Card.order.asc(),
                Card.created_at.asc(),
                Card.id.asc(),
            )
        ).scalars().all()

        for card in cards:
            cards_by_column[card.column_id].append(card)

        all_cards = list(cards)

    labels = list(
        db.session.execute(
            db.select(Label).where(Label.board_id == board.id)
        ).scalars().all()
    )

    members = list(
        db.session.execute(
            db.select(BoardMember, User)
            .join(User, User.id == BoardMember.user_id)
            .where(BoardMember.board_id == board.id)
            .order_by(
                BoardMember.role.desc(),
                User.name.asc().nulls_last(),
            )
        ).all()
    )

    # Move rule: board owner may move anything; otherwise a card can be moved
    # only by its creator or a user tagged on it.
    card_ids: list[uuid.UUID] = [card.id for card in all_cards]
    tagged_card_ids: set[uuid.UUID] = set()

    assignees_by_card: dict[uuid.UUID, list[uuid.UUID]] = {
        card_id: [] for card_id in card_ids
    }

    if card_ids:
        rows = db.session.execute(
            db.select(
                CardAssignee.card_id,
                CardAssignee.user_id,
            ).where(CardAssignee.card_id.in_(card_ids))
        ).all()

        for card_id, user_id in rows:
            assignees_by_card[card_id].append(user_id)

            if user_id == current_user.id:
                tagged_card_ids.add(card_id)

    def _can_move(card: Card) -> bool:
        if board.owner_id == current_user.id:
            return True

        if card.owner_id == current_user.id:
            return True

        return card.id in tagged_card_ids

    can_move_by_card = {
        card.id: _can_move(card)
        for card in all_cards
    }

    return (
        board,
        columns,
        cards_by_column,
        labels,
        members,
        can_move_by_card,
        assignees_by_card,
    )


def update_board(
    current_user: User,
    board_id: uuid.UUID,
    data: dict,
) -> Board:
    """Partially update a board owned by current_user."""

    board = get_board_for_user(current_user, board_id, write=True)

    if "name" in data:
        new_name = data["name"]

        if new_name.lower() != board.name.lower():
            _check_name_conflict(
                board.owner_id,
                new_name,
                exclude_board_id=board.id,
            )

        board.name = new_name

    if "is_favorite" in data:
        board.is_favorite = data["is_favorite"]

    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise

    return board


def delete_board(current_user: User, board_id: uuid.UUID) -> None:
    """Delete a board and all its child records."""

    board = get_board_for_user(current_user, board_id, write=True)

    try:
        db.session.delete(board)
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise