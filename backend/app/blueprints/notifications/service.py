"""Notifications service."""

import uuid

from app.common.exceptions import NotificationNotFoundException
from app.extensions import db
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


def _notification_recipients(board_owner_id: uuid.UUID, author_id: uuid.UUID) -> list[uuid.UUID]:
    """Return the user ids to notify about a new comment.

    Boards have a single owner today, so the owner is notified on every
    comment, including their own. Narrow this to exclude *author_id* once
    boards can be shared.
    """
    return [board_owner_id]


def notify_comment_added(board_owner_id: uuid.UUID, card, comment, author) -> None:
    """Stage a notification for each recipient of a new comment.

    Does NOT commit; the caller owns the transaction so the comment and its
    notification are saved together.
    """
    for user_id in _notification_recipients(board_owner_id, author.id):
        db.session.add(
            Notification(
                user_id=user_id,
                title=f"New comment on {card.title[:200]}",
                body=comment.body[:500],
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
