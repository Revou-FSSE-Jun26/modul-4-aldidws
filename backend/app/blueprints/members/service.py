"""
Board-members service.

Manages membership rows on a board and the per-card tag set.  All
operations go through the shared access layer, keeping the established
non-disclosing 404 contract.
"""

import uuid

from sqlalchemy import delete as sa_delete, func

from app.access import get_board_for_user, get_card_for_user
from app.blueprints.notifications.service import notify_member_invited
from app.common.exceptions import (
    BoardNotFoundException,
    CardNotFoundException,
    ResourceConflictException,
    UserNotFoundException,
)
from app.extensions import db
from app.models.board import Board
from app.models.board_column import BoardColumn
from app.models.board_member import BoardMember
from app.models.card import Card
from app.models.card_assignee import CardAssignee
from app.models.user import User


def invite_member(current_user, board_id: uuid.UUID, email: str) -> BoardMember:
    """Add a registered account to *board_id* as a member.

    Args:
        current_user: The authenticated owner issuing the invite.
        board_id: Target board; only the board owner may invite.
        email: The invitee's registered email (case-insensitive).

    Returns:
        The new ``BoardMember`` row.

    Raises:
        BoardNotFoundException: When the caller is not the board owner.
        UserNotFoundException: When no account exists for *email*.
        ResourceConflictException: When the account is already a member.
    """
    board = get_board_for_user(current_user, board_id, write=True)

    invitee = db.session.execute(
        db.select(User).where(func.lower(User.email) == email)
    ).scalar_one_or_none()

    if invitee is None:
        raise UserNotFoundException()

    existing = db.session.execute(
        db.select(BoardMember).where(
            BoardMember.board_id == board.id,
            BoardMember.user_id == invitee.id,
        )
    ).scalar_one_or_none()

    if existing is not None:
        raise ResourceConflictException(
            message="That user is already a member of this board."
        )

    membership = BoardMember(board_id=board.id, user_id=invitee.id, role="member")
    try:
        db.session.add(membership)
        inviter_name = current_user.name or current_user.email
        notify_member_invited(invitee.id, board.name, inviter_name)
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise

    return membership


def remove_member(current_user, board_id: uuid.UUID, user_id: uuid.UUID) -> None:
    """Remove a member from *board_id*; the owner row can never be removed.

    Raising:
        BoardNotFoundException: When the caller is not the board owner, or the
            membership does not exist.
        ResourceConflictException: When *user_id* is the board owner.

    Removing a member also deletes their card tags on this board.
    """
    board = get_board_for_user(current_user, board_id, write=True)

    target = db.session.execute(
        db.select(BoardMember).where(
            BoardMember.board_id == board.id,
            BoardMember.user_id == user_id,
        )
    ).scalar_one_or_none()

    if target is None:
        raise BoardNotFoundException()

    if target.role == "owner":
        raise ResourceConflictException(
            message="The board owner cannot be removed from the board."
        )

    try:
        # Explicitly clean up card tags the removed user holds on this board
        # (the user-level FK cascade only fires when the user row itself is
        # deleted, not when the membership is removed).
        board_card_ids = db.select(Card.id).where(
            Card.column_id.in_(
                db.select(BoardColumn.id).where(BoardColumn.board_id == board.id)
            )
        )
        db.session.execute(
            sa_delete(CardAssignee).where(
                CardAssignee.user_id == user_id,
                CardAssignee.card_id.in_(board_card_ids),
            )
        )
        db.session.delete(target)
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise


def list_members(current_user, board_id: uuid.UUID):
    """Return ``(BoardMember, User)`` pairs for every member of the board.

    Any board member may list the board's members; a non-member receives a
    non-disclosing 404.
    """
    board = get_board_for_user(current_user, board_id)
    rows = db.session.execute(
        db.select(BoardMember, User)
        .join(User, User.id == BoardMember.user_id)
        .where(BoardMember.board_id == board.id)
        .order_by(BoardMember.role.desc(), User.name.asc().nulls_last())
    ).all()
    return rows


def set_card_assignees(current_user, card_id: uuid.UUID, user_ids: list[uuid.UUID]) -> Card:
    """Replace the tag set on *card_id*; board owner only.

    Every *user_ids* entry must be a member of the card's board — unknown or
    non-member ids raise a non-disclosing 404.  An empty list clears all
    tags.
    """
    card = get_card_for_user(current_user, card_id, write=True)

    board_id = db.session.execute(
        db.select(BoardColumn.board_id).where(BoardColumn.id == card.column_id)
    ).scalar_one()

    # Only the board owner may manage tags.
    get_board_for_user(current_user, board_id, write=True)

    member_ids = set(
        db.session.execute(
            db.select(BoardMember.user_id).where(BoardMember.board_id == board_id)
        ).scalars().all()
    )

    for uid in user_ids:
        if uid not in member_ids:
            raise CardNotFoundException()

    try:
        db.session.execute(
            sa_delete(CardAssignee).where(CardAssignee.card_id == card.id)
        )
        for uid in user_ids:
            db.session.add(CardAssignee(card_id=card.id, user_id=uid))
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise

    db.session.refresh(card)
    return card
