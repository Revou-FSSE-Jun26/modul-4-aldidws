"""
Shared board-access layer.

Every write operation in the application goes through one of the helpers
here.  The helpers keep the established *non-disclosing 404* contract: an
unknown board, a board the caller is not a member of, or an owner-only
operation performed by a plain member all raise the same ``*NotFound``
exception — never a 403.

Move permission rule
--------------------
A user may move card *C* on board *B* iff:

- the user's membership in *B* has role ``'owner'``, OR
- ``C.owner_id`` is the user (they created the card), OR
- the user is tagged on *C* (a ``card_assignees`` row).

Board-level membership (view) is open to every row in ``board_members``.
"""

import uuid

from sqlalchemy import select

from app.common.exceptions import (
    BoardNotFoundException,
    CardNotFoundException,
    ColumnNotFoundException,
)
from app.extensions import db
from app.models.board import Board
from app.models.board_column import BoardColumn
from app.models.board_member import BoardMember
from app.models.card import Card
from app.models.user import User


# ---------------------------------------------------------------------------
# Membership lookups
# ---------------------------------------------------------------------------


def is_board_member(user: User, board_id: uuid.UUID) -> bool:
    """True when *user* has any membership row on *board_id*."""
    return db.session.execute(
        select(BoardMember.user_id)
        .where(
            BoardMember.board_id == board_id,
            BoardMember.user_id == user.id,
        )
        .limit(1)
    ).first() is not None


def board_role(user: User, board_id: uuid.UUID) -> str | None:
    """The caller's role on *board_id* (``'owner'`` or ``'member'``), or None."""
    role = db.session.execute(
        select(BoardMember.role).where(
            BoardMember.board_id == board_id,
            BoardMember.user_id == user.id,
        )
    ).scalar_one_or_none()
    return role


def accessible_board_ids(user: User) -> set[uuid.UUID]:
    """IDs of every board *user* may read: owned or member."""
    owned = db.session.execute(
        select(Board.id).where(Board.owner_id == user.id)
    ).scalars().all()
    member = db.session.execute(
        select(BoardMember.board_id).where(BoardMember.user_id == user.id)
    ).scalars().all()
    return set(owned) | set(member)


# ---------------------------------------------------------------------------
# Board access
# ---------------------------------------------------------------------------


def get_board_for_user(
    user: User,
    board_id: uuid.UUID,
    *,
    write: bool = False,
) -> Board:
    """Return the board *user* may access, or raise a non-disclosing 404.

    ``write=True`` additionally requires role ``'owner'``.
    """
    board = db.session.execute(
        db.select(Board).where(Board.id == board_id)
    ).scalar_one_or_none()

    if board is None:
        raise BoardNotFoundException()

    if not is_board_member(user, board_id):
        raise BoardNotFoundException()

    if write and board_role(user, board_id) != "owner":
        raise BoardNotFoundException()

    return board


# ---------------------------------------------------------------------------
# Column access
# ---------------------------------------------------------------------------


def get_column_for_user(
    user: User,
    column_id: uuid.UUID,
    *,
    write: bool = False,
) -> BoardColumn:
    """Return the column whose board *user* may access, or raise 404."""
    col = db.session.execute(
        db.select(BoardColumn)
        .join(BoardColumn.board)
        .where(BoardColumn.id == column_id)
    ).scalar_one_or_none()

    if col is None:
        raise ColumnNotFoundException()

    if not is_board_member(user, col.board_id):
        raise ColumnNotFoundException()

    if write and board_role(user, col.board_id) != "owner":
        raise ColumnNotFoundException()

    return col


# ---------------------------------------------------------------------------
# Card access
# ---------------------------------------------------------------------------

from app.models.card_assignee import CardAssignee  # noqa: E402


def _get_card_row(card_id: uuid.UUID, live_only: bool = True):
    query = db.select(Card).where(Card.id == card_id)
    if live_only:
        query = query.where(Card.deleted_at.is_(None))
    return db.session.execute(query).scalar_one_or_none()


def _card_board_id(card: Card) -> uuid.UUID:
    return db.session.execute(
        db.select(BoardColumn.board_id).where(BoardColumn.id == card.column_id)
    ).scalar_one()


def card_assignee_ids(card_id: uuid.UUID) -> set[uuid.UUID]:
    """Return the set of user ids tagged on *card_id*."""
    ids = db.session.execute(
        db.select(CardAssignee.user_id).where(CardAssignee.card_id == card_id)
    ).scalars().all()
    return set(ids)


def card_can_move(user: User, card: Card, board_id: uuid.UUID) -> bool:
    """Move rule: board owner OR card creator OR tagged on the card."""
    if board_role(user, board_id) == "owner":
        return True
    if card.owner_id == user.id:
        return True
    return user.id in card_assignee_ids(card.id)


def get_card_for_user(
    user: User,
    card_id: uuid.UUID,
    *,
    write: bool = False,
    move: bool = False,
) -> Card:
    """Return a live card on a board *user* may access, or raise 404.

    - ``write``: card owner OR board owner (editing title/description).
    - ``move``:  board owner OR card owner OR tagged on the card.
    """
    card = _get_card_row(card_id)
    if card is None:
        raise CardNotFoundException()

    board_id = _card_board_id(card)
    board = db.session.execute(db.select(Board).where(Board.id == board_id)).scalar_one_or_none()
    if board is None:
        raise CardNotFoundException()

    if not is_board_member(user, board_id):
        raise CardNotFoundException()

    role = board_role(user, board_id)

    if write and role != "owner" and card.owner_id != user.id:
        raise CardNotFoundException()

    if move and not card_can_move(user, card, board_id):
        raise CardNotFoundException()

    return card
