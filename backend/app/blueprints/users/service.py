"""Users service."""

from sqlalchemy import func, or_

from app.extensions import db
from app.models.board import Board
from app.models.board_column import BoardColumn
from app.models.board_member import BoardMember
from app.models.card import Card
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


def get_workspace_summary(current_user: User) -> dict:
    """Return summary statistics for the authenticated user's workspace.

    Returns:
        dict with keys:
            workspace_name: ``<user.name>'s workspace`` or fallback.
            projects: number of boards the user owns.
            tasks: number of live (non-deleted) cards across boards the user
                owns or is a member of.
            members: number of distinct users who share at least one board
                with the caller (the caller included).
    """
    display = (current_user.name or current_user.email or "").strip()
    workspace_name = f"{display}'s workspace" if display else "My workspace"

    accessible = or_(
        Board.owner_id == current_user.id,
        Board.id.in_(
            db.select(BoardMember.board_id).where(BoardMember.user_id == current_user.id)
        ),
    )

    projects: int = db.session.execute(
        db.select(func.count(Board.id)).where(Board.owner_id == current_user.id)
    ).scalar_one()

    tasks: int = db.session.execute(
        db.select(func.count(Card.id))
        .join(BoardColumn, Card.column_id == BoardColumn.id)
        .join(Board, BoardColumn.board_id == Board.id)
        .where(
            accessible,
            Card.deleted_at.is_(None),
        )
    ).scalar_one()

    members: int = db.session.execute(
        db.select(func.count(func.distinct(User.id)))
        .select_from(User)
        .join(BoardMember, BoardMember.user_id == User.id)
        .join(Board, Board.id == BoardMember.board_id)
        .where(accessible)
    ).scalar_one()

    return {
        "workspace_name": workspace_name,
        "projects": projects,
        "tasks": tasks,
        "members": members,
    }
