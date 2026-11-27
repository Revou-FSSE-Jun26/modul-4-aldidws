"""
BoardMember model.

A board can have multiple member accounts.  The owner always has a
``role='owner'`` row (backfilled by the migration that introduced the
table); invited accounts get ``role='member'`` rows.  ``Board`` keeps its
``owner_id`` column for backward compatibility, but every access check in
the application goes through this table.
"""

import uuid
from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKeyConstraint,
    Index,
    PrimaryKeyConstraint,
    String,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.extensions import db


class BoardMember(db.Model):
    """A membership row linking a user to a board they can access.

    Columns
    -------
    board_id / user_id:
        Composite unique pair; both cascade when the board or user is
        deleted.
    role:
        ``'owner'`` or ``'member'``.  The owner row is created with the
        board; member rows are created when the owner invites another
        registered account.
    """

    __tablename__ = "board_members"

    __table_args__ = (
        PrimaryKeyConstraint("board_id", "user_id", name="pk_board_members"),
        CheckConstraint("role IN ('owner','member')", name="ck_board_members_role"),
        ForeignKeyConstraint(
            ["board_id"], ["boards.id"], ondelete="CASCADE", name="fk_board_members_board_id_boards"
        ),
        ForeignKeyConstraint(
            ["user_id"], ["users.id"], ondelete="CASCADE", name="fk_board_members_user_id_users"
        ),
        Index("ix_board_members_user_id", "user_id"),
    )

    board_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), nullable=False)
    role: Mapped[str] = mapped_column(String(16), nullable=False, default="member")

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
