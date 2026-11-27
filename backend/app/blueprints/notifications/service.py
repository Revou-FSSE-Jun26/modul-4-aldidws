"""Notifications service."""

import uuid

from app.common.exceptions import NotificationNotFoundException
from app.extensions import db
from app.models.board_column import BoardColumn
from app.models.board_member import BoardMember
from app.models.notification import Notification


def list_notifications(current_user, page: int = 1, per_page: int = 20):
    """Return a paginated list of notifications for *current_user*, newest first.

    Args:
        current_user: The authenticated user.
        page: 1-based page number (default 1).
        per_page: Maximum rows per page (default 20, max 100).

    Returns:
        Tuple of (items: list[Notification], total: int).
    """
    # Cap enforced by the route layer (min(per_page, 100)) before calling here.
    offset = (page - 1) * per_page

    total = db.session.execute(
        db.select(db.func.count(Notification.id))
        .where(Notification.user_id == current_user.id)
    ).scalar() or 0

    items = db.session.execute(
        db.select(Notification)
        .where(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .limit(per_page)
        .offset(offset)
    ).scalars().all()

    return items, total


def count_unread(current_user) -> int:
    """Return how many notifications *current_user* has not read."""
    return db.session.execute(
        db.select(db.func.count(Notification.id))
        .where(Notification.user_id == current_user.id)
        .where(Notification.is_read.is_(False))
    ).scalar() or 0


def _notification_recipients(board_id: uuid.UUID, exclude_id: uuid.UUID) -> list[uuid.UUID]:
    """Return the user ids to notify on a board event.

    Every board member is a recipient except *exclude_id* (the actor), so
    the author of a comment or the mover of a card never receives a
    notification about their own action.  Boards with a single owner simply
    yield an empty list — there is nobody else to notify.
    """
    ids = db.session.execute(
        db.select(BoardMember.user_id).where(
            BoardMember.board_id == board_id,
            BoardMember.user_id != exclude_id,
        )
    ).scalars().all()
    return list(ids)


def notify_comment_added(board_id: uuid.UUID, card, comment, author) -> None:
    """Stage a notification for each recipient of a new comment.

    Does NOT commit; the caller owns the transaction so the comment and its
    notifications are saved together.
    """
    for user_id in _notification_recipients(board_id, author.id):
        db.session.add(
            Notification(
                user_id=user_id,
                title=f"New comment on {card.title[:200]}",
                body=comment.body[:500],
            )
        )


def notify_card_moved(board_id: uuid.UUID, card, mover) -> None:
    """Stage a notification for each recipient of a card move.

    The mover is excluded; other board members are told which card moved
    and where it landed.  Does NOT commit; the caller owns the transaction.
    """
    column_name = db.session.execute(
        db.select(BoardColumn.name).where(BoardColumn.id == card.column_id)
    ).scalar_one_or_none()

    mover_name = (mover.name or "Someone").strip() or "Someone"
    body = f"Card moved to '{column_name}'." if column_name else "Card moved to a new column."

    for user_id in _notification_recipients(board_id, mover.id):
        db.session.add(
            Notification(
                user_id=user_id,
                title=f"{mover_name} moved {card.title[:120]}",
                body=body[:500],
            )
        )


def notify_member_invited(member_user_id: uuid.UUID, board_name: str, inviter_name: str | None) -> None:
    """Stage a notification telling the invitee they joined a board.

    Does NOT commit; the caller owns the transaction so the membership row
    and the notification are saved together.
    """
    db.session.add(
        Notification(
            user_id=member_user_id,
            title=f"You joined {board_name[:150]}",
            body=(f"{inviter_name} added you to this board.") if inviter_name else "You were added to this board.",
        )
    )


def mark_read(current_user, notification_id: uuid.UUID) -> Notification:
    """Mark a notification as read.

    Raises:
        NotificationNotFoundException: When the notification does not exist
            or does not belong to *current_user*.
    """
    n = db.session.execute(
        db.select(Notification)
        .where(Notification.id == notification_id)
        .where(Notification.user_id == current_user.id)
    ).scalar_one_or_none()

    if n is None:
        raise NotificationNotFoundException()

    n.is_read = True

    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise

    return n
