"""
Boards service.

Contains the business logic for board operations.  Every function here MUST:

- Remain independent of Flask request and response objects.
- Raise typed ``AppException`` subclasses for expected failures.
- Enforce ownership before returning or mutating data.
"""

import uuid

from sqlalchemy import func
from sqlalchemy.orm import selectinload

from app.access import get_board_for_user
from app.common.exceptions import BoardNotFoundException, ResourceConflictException
from app.extensions import db
from app.models.board import Board
from app.models.board_column import BoardColumn
from app.models.board_member import BoardMember
from app.models.card import Card
from app.models.label import Label
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
    """Return the board *user* may access, or raise a non-disclosing 404.

    Kept for backward compatibility with service modules that still import
    this name; delegates to the shared access layer.
    """
    return get_board_for_user(user, board_id)


def create_board(current_user: User, name: str) -> Board:
    """Create and persist a new board owned by *current_user*.

    The owner's ``board_members`` row (role ``'owner'``) is created in the
    same transaction so every access check can go through the membership
    table uniformly.

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
    membership = BoardMember(board_id=None, user_id=current_user.id, role="owner")

    try:
        db.session.add(board)
        membership.board_id = board.id
        db.session.add(membership)
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise

    return board


def list_boards(current_user: User) -> tuple[list[Board], dict[uuid.UUID, str]]:
    """Return all boards *current_user* may access, plus each board's role.

    Args:
        current_user: The authenticated user whose boards are listed.

    Returns:
        Tuple ``(boards, roles)`` where ``boards`` is a list of ``Board``
        instances ordered by creation time ascending, and ``roles`` maps
        board id to the caller's role on that board
        (``'owner'`` or ``'member'``).
    """
    # One query gets every board the user owns or is a member of, and the
    # second query tells us which role the user holds on each board.
    accessible = {
        b.id for b in db.session.execute(
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
        b.id: ("owner" if b.owner_id == current_user.id else "member") for b in boards
    }
    return boards, roles


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
    """Return a board with columns, live cards, labels, members and can_move.

    Returns:
        Tuple ``(board, columns, cards_by_column, labels, members,
        can_move_by_card, assignees_by_card)`` where ``cards_by_column``
        maps column id to its non-deleted cards ordered by ``order``,
        ``labels`` are the board's labels, ``members`` is the list of
        (BoardMember, User) pairs, ``can_move_by_card`` maps card id to a
        bool (can the caller drag it?) and ``assignees_by_card`` maps card
        id to the list of tagged member ids.

    Raises:
        BoardNotFoundException: When the board does not exist or
            *current_user* is not a member (non-disclosing 404).
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
    all_cards: list[Card] = []
    if columns:
        cards = db.session.execute(
            db.select(Card)
            .options(selectinload(Card.labels))
            .where(
                Card.column_id.in_(list(cards_by_column)),
                Card.deleted_at.is_(None),
            )
            .order_by(Card.order.asc(), Card.created_at.asc(), Card.id.asc())
        ).scalars().all()
        for card in cards:
            cards_by_column[card.column_id].append(card)
        all_cards = list(cards)

    labels = list(
        db.session.execute(db.select(Label).where(Label.board_id == board.id)).scalars().all()
    )

    members = list(
        db.session.execute(
            db.select(BoardMember, User)
            .join(User, User.id == BoardMember.user_id)
            .where(BoardMember.board_id == board.id)
            .order_by(BoardMember.role.desc(), User.name.asc().nulls_last())
        ).all()
    )

    # Move rule: board owner may move anything; otherwise a card can be moved
    # only by its creator or a user tagged on it.
    from app.models.card_assignee import CardAssignee

    card_ids: list[uuid.UUID] = [c.id for c in all_cards]
    tagged_card_ids: set[uuid.UUID] = set()
    assignees_by_card: dict[uuid.UUID, list[uuid.UUID]] = {cid: [] for cid in card_ids}

    if card_ids:
        rows = db.session.execute(
            db.select(CardAssignee.card_id, CardAssignee.user_id).where(
                CardAssignee.card_id.in_(card_ids)
            )
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

    can_move_by_card = {card.id: _can_move(card) for card in all_cards}

    return board, columns, cards_by_column, labels, members, can_move_by_card, assignees_by_card


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
    board = get_board_for_user(current_user, board_id, write=True)

    if "name" in data:
        new_name = data["name"]
        if new_name.lower() != board.name.lower():
            _check_name_conflict(current_user, new_name, exclude_board_id=board.id)
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
        BoardNotFoundException: When the board does not exist or *current_user*
            is not the owner (non-disclosing 404).
    """
    board = get_board_for_user(current_user, board_id, write=True)

    try:
        db.session.delete(board)
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise
