"""
Comments service.

Contains the business logic for comment operations.  Every function here MUST:

- Remain independent of Flask request and response objects.
- Raise typed ``AppException`` subclasses for expected failures.
- Enforce ownership before returning or mutating data.
"""

import uuid

from app.access import get_card_for_user
from app.common.exceptions import CardNotFoundException, CommentNotFoundException, UnauthorizedCommentAccessError
from sqlalchemy.orm import selectinload

from app.blueprints.notifications.service import notify_comment_added
from app.extensions import db
from app.models.board_column import BoardColumn
from app.models.card import Card
from app.models.card_comment import CardComment


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------


def _get_card_for_user(current_user, card_id: uuid.UUID) -> Card:
    """Return a live card on a board the caller may access, or raise 404.

    Commenting is open to every board member; the shared access layer keeps
    the non-disclosing 404 contract.
    """
    return get_card_for_user(current_user, card_id)


# ---------------------------------------------------------------------------
# Public service functions
# ---------------------------------------------------------------------------


def create_comment(current_user, card_id: uuid.UUID, data: dict) -> CardComment:
    """Create a new comment on a card owned (via board) by *current_user*.

    Args:
        current_user: The authenticated user creating the comment.
        card_id: UUID of the target card.
        data: Validated request data from ``CreateCommentSchema``.

    Returns:
        The newly created ``CardComment`` instance.

    Raises:
        CardNotFoundException: When the card does not exist or its board is
            not owned by *current_user*.
    """
    card = _get_card_for_user(current_user, card_id)

    comment = CardComment(
        card_id=card_id,
        author_id=current_user.id,
        body=data["body"],
    )

    board_id = db.session.execute(
        db.select(BoardColumn.board_id).where(BoardColumn.id == card.column_id)
    ).scalar_one()

    try:
        db.session.add(comment)
        # Notify every board member except the comment's author.
        notify_comment_added(board_id, card, comment, current_user)
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise

    db.session.refresh(comment)
    return comment


def list_comments(current_user, card_id: uuid.UUID) -> list[CardComment]:
    """Return all comments for a card, ordered by created_at ascending.

    Args:
        current_user: The authenticated user requesting the list.
        card_id: UUID of the card whose comments are requested.

    Returns:
        A list of ``CardComment`` instances ordered by ``created_at`` ASC.

    Raises:
        CardNotFoundException: When the card does not exist or its board is
            not owned by *current_user*.
    """
    _get_card_for_user(current_user, card_id)

    comments = db.session.execute(
        db.select(CardComment)
        .where(CardComment.card_id == card_id)
        .options(selectinload(CardComment.author))
        .order_by(CardComment.created_at.asc())
    ).scalars().all()

    return list(comments)


def update_comment(current_user, comment_id: uuid.UUID, data: dict) -> CardComment:
    """Partially update a comment owned by *current_user*.

    Args:
        current_user: The authenticated user requesting the update.
        comment_id: UUID of the comment to update.
        data: Validated request data from ``UpdateCommentSchema`` (partial).

    Returns:
        The updated ``CardComment`` instance with refreshed ``updated_at``.

    Raises:
        CommentNotFoundException: When the comment does not exist.
        UnauthorizedCommentAccessError: When the comment exists but belongs to another user.
    """
    comment = db.session.get(CardComment, comment_id)

    if comment is None:
        raise CommentNotFoundException()

    if comment.author_id != current_user.id:
        raise UnauthorizedCommentAccessError()

    if "body" in data:
        comment.body = data["body"]

    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise

    db.session.refresh(comment)

    return comment


def delete_comment(current_user, comment_id: uuid.UUID) -> None:
    """Delete a comment owned by *current_user*.

    Args:
        current_user: The authenticated user requesting the deletion.
        comment_id: UUID of the comment to delete.

    Raises:
        CommentNotFoundException: When the comment does not exist.
        UnauthorizedCommentAccessError: When the comment exists but belongs to another user.
    """
    comment = db.session.get(CardComment, comment_id)

    if comment is None:
        raise CommentNotFoundException()

    if comment.author_id != current_user.id:
        raise UnauthorizedCommentAccessError()

    try:
        db.session.delete(comment)
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise
