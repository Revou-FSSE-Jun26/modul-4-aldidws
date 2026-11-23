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
