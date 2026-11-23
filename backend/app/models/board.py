"""
Board model.

A board is the top-level container for a user's work.  Every board is
privately owned; the MVP has no sharing between accounts.  Columns and,
through them, cards cascade-delete when a board is removed.
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.extensions import db


class Board(db.Model):
    """A private workspace owned by a single user.

    Columns
    -------
    id:
        UUID primary key, application-generated.
    owner_id:
        Foreign key to ``users.id``.  Every board MUST have a valid owner.
        Cascades on user deletion.
    name:
        Display name for the board.  Maximum 100 characters.
    created_at / updated_at:
        UTC timestamps managed by the database.
    """

    __tablename__ = "boards"

    # ------------------------------------------------------------------
    # Primary key
    # ------------------------------------------------------------------

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    # ------------------------------------------------------------------
    # Foreign key
    # ------------------------------------------------------------------

    owner_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # ------------------------------------------------------------------
    # Data columns
    # ------------------------------------------------------------------

    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    # ------------------------------------------------------------------
    # Timestamps
    # ------------------------------------------------------------------

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    # ------------------------------------------------------------------
    # Relationships
    # ------------------------------------------------------------------

    owner: Mapped["User"] = relationship(  # type: ignore[name-defined]  # noqa: F821
        "User",
        back_populates="boards",
    )

    columns: Mapped[list["BoardColumn"]] = relationship(  # type: ignore[name-defined]  # noqa: F821
        "BoardColumn",
        back_populates="board",
        lazy="select",
        # Database CASCADE handles physical deletion of child columns and,
        # through them, cards.  passive_deletes avoids a redundant ORM
        # SELECT before the database enforces the constraint.
        passive_deletes=True,
    )

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def to_dict(self) -> dict:
        return {
            "id": str(self.id),
            "owner_id": str(self.owner_id),
            "name": self.name,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }

    def __repr__(self) -> str:
        return f"<Board id={self.id} name={self.name!r}>"
