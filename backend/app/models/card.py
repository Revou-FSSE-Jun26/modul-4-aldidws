"""
Card model.

A card is a task or work item that lives inside a board column.  It is
owned by a user (the creator) and belongs to a column.  Moving a card to
a different column is an atomic service-layer operation that updates both
``column_id`` and ``order``.

Ordering note: a UNIQUE(column_id, order) constraint is intentionally
omitted here.  It will be added in a later migration once the reorder
service is implemented and tested, as the constraint requires a safe
transactional reorder strategy to avoid temporary uniqueness violations.
"""

import uuid
from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Index,
    String,
    Text,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.extensions import db


class Card(db.Model):
    """A task or work item within a board column.

    Columns
    -------
    id:
        UUID primary key, application-generated.
    column_id:
        Foreign key to ``board_columns.id``.  Cascades on column deletion.
    owner_id:
        Foreign key to ``users.id``.  Records the creating user for
        ownership enforcement.  Cascades on user deletion.
    title:
        Required display label.  Maximum 255 characters.
    description:
        Optional free-form body text.
    order:
        Float ordering value within the column.  Must be >= 0.
    deleted_at:
        Optional soft-delete timestamp (UTC, timezone-aware).
    created_at / updated_at:
        UTC timestamps managed by the database.
    """

    __tablename__ = "cards"

    __table_args__ = (
        CheckConstraint('"order" >= 0', name="ck_cards_order_nonneg"),
        # Composite index: the most common query fetches all cards for a
        # column ordered by order.
        Index("ix_cards_column_id_order", "column_id", "order"),
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
    # Foreign keys
    # ------------------------------------------------------------------

    column_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("board_columns.id", ondelete="CASCADE"),
        nullable=False,
        # Covered by the composite index above.
    )

    owner_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # ------------------------------------------------------------------
    # Data columns
    # ------------------------------------------------------------------

    title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    order: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        default=0.0,
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

    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # ------------------------------------------------------------------
    # Relationships
    # ------------------------------------------------------------------

    column: Mapped["BoardColumn"] = relationship(  # type: ignore[name-defined]  # noqa: F821
        "BoardColumn",
        back_populates="cards",
    )

    comments: Mapped[list["CardComment"]] = relationship(  # type: ignore[name-defined]  # noqa: F821
        "CardComment",
        back_populates="card",
        lazy="select",
        passive_deletes=True,
    )

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def to_dict(self) -> dict:
        """Return a safe, serializable representation of the card.

        ``owner_id`` is included because callers need it for ownership
        checks in API responses.
        """
        return {
            "id": str(self.id),
            "column_id": str(self.column_id),
            "owner_id": str(self.owner_id),
            "title": self.title,
            "description": self.description,
            "order": self.order,
            "deleted_at": self.deleted_at.isoformat() if self.deleted_at else None,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }

    def __repr__(self) -> str:
        return f"<Card id={self.id} title={self.title!r} order={self.order}>"
