"""Users service."""

from app.extensions import db
from app.models.user import User


def get_me(current_user) -> User:
    """Return the authenticated user's own profile."""
    return current_user


def update_me(current_user, data: dict) -> User:
    """Update mutable profile fields for *current_user*.

    Supported fields: ``name``, ``timezone``.
    """
    if "name" in data:
        current_user.name = data["name"]
    if "timezone" in data:
        current_user.timezone = data["timezone"]

    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise

    return current_user
