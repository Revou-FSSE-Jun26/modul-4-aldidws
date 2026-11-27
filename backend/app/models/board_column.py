"""
BoardColumn model.

An ordered workflow stage within a board (e.g. "To Do", "In Progress",
"Done").  Columns belong exclusively to one board and cascade-delete when
their board is removed.  Cards cascade-delete when their column is removed.

Ordering note: a UNIQUE(board_id, position) constraint is intentionally
omitted here.  It will be added in a later migration once the reorder
service is implemented and tested, as the constraint requires a safe
transactional reorder strategy to avoid temporary uniqueness violations.
"""

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Index,
    String,
    Uuid,
    false,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.extensions import db


class BoardColumn(db.Model):
    """An ordered stage within a board.

    Columns
    -------
    id:
        UUID primary key, application-generated.
    board_id:
        Foreign key to ``boards.id``.  Cascades on board deletion.
    name:
        Display name (e.g. "Backlog").  Maximum 100 characters.
    position:
        Zero-based float determining display order.  Must be >= 0.
        Using a float allows inserting a column between two existing
        positions (e.g. 1.5 between 1.0 and 2.0) without renumbering.
        Uniqueness per board is enforced by the service layer during
        create and reorder operations.
    color:
        Optional status color: gray, blue, orange, green or red.  NULL means
        the user has not picked one; the client cycles colors by position.
    is_done:
        True when the column holds finished work (explicit flag, not name
        matching).  Defaults to false.
    created_at / updated_at:
        UTC timestamps managed by the database.
    """

    __tablename__ = "board_columns"

    __table_args__ = (
        CheckConstraint(
            "position >= 0",
            name="ck_board_columns_position_nonnegative",
        ),
        CheckConstraint(
            "color IS NULL OR color IN ('gray','blue','orange','green','red')",
            name="ck_board_columns_color",
        ),
        # Composite index: the most common query fetches all columns for a
        # board ordered by position.
        Index("ix_board_columns_board_id_position", "board_id", "position"),
    )

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

    board_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("boards.id", ondelete="CASCADE"),
        nullable=False,
        # Covered by the composite index above; no separate single-column
        # index is needed.
    )

    # ------------------------------------------------------------------
    # Data columns
    # ------------------------------------------------------------------

    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    position: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        default=0.0,
    )
    color: Mapped[str | None] = mapped_column(
        String(16),
        nullable=True,
    )
    is_done: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default=false(),
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

    board: Mapped["Board"] = relationship(  # type: ignore[name-defined]  # noqa: F821
        "Board",
        back_populates="columns",
    )

    cards: Mapped[list["Card"]] = relationship(  # type: ignore[name-defined]  # noqa: F821
        "Card",
        back_populates="column",
        lazy="select",
        passive_deletes=True,
    )

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def to_dict(self) -> dict:
        return {
            "id": str(self.id),
            "board_id": str(self.board_id),
            "name": self.name,
            "position": self.position,
            "color": self.color,
            "is_done": self.is_done,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }

    def __repr__(self) -> str:
        return (
            f"<BoardColumn id={self.id} name={self.name!r} position={self.position}>"
        )
