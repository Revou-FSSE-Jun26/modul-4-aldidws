"""
CardComment model.

A comment is a discussion entry attached to a card.  Comments are mutable
(authors may edit their own body text) but are not soft-deleted — physical
deletion is the lifecycle.  Deleting the parent card also deletes all of
its comments via the database CASCADE.
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Text, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.extensions import db


class CardComment(db.Model):
    """A discussion comment attached to a card.

    Columns
    -------
    id:
        UUID primary key, application-generated.
    card_id:
        Foreign key to ``cards.id``.  Cascades on card deletion.
    author_id:
        Foreign key to ``users.id``.  Records the commenting user.
        Cascades on user deletion.
    body:
        Free-form comment text.  Required; not nullable.
    created_at:
        UTC timestamp set by the database when the row is inserted.
        Comments are ordered by this column.
    updated_at:
        UTC timestamp updated by the ORM on edit.  Its presence lets
        the API surface whether a comment was later modified.
    """

    __tablename__ = "card_comments"

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

    card_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("cards.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    author_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # ------------------------------------------------------------------
    # Data columns
    # ------------------------------------------------------------------

    body: Mapped[str] = mapped_column(
        Text,
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

    card: Mapped["Card"] = relationship(  # type: ignore[name-defined]  # noqa: F821
        "Card",
        back_populates="comments",
    )

    author: Mapped["User"] = relationship(  # type: ignore[name-defined]  # noqa: F821
        "User",
        back_populates="card_comments",
    )

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def to_dict(self) -> dict:
        return {
            "id": str(self.id),
            "card_id": str(self.card_id),
            "author_id": str(self.author_id),
            "body": self.body,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }

    def __repr__(self) -> str:
        return f"<CardComment id={self.id} card_id={self.card_id}>"
