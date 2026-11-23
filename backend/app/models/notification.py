"""Notification model."""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.extensions import db


class Notification(db.Model):
    """A notification delivered to a user.

    Columns
    -------
    id:
        UUID primary key, application-generated.
    user_id:
        Foreign key to ``users.id``.  Cascades on user deletion.
    title:
        Short notification heading.  Maximum 255 characters.
    body:
        Optional longer body text.
    is_read:
        Whether the user has acknowledged this notification.
    created_at:
        UTC timestamp set by the database on insert.
    updated_at:
        UTC timestamp updated by the ORM on modification.
    """

    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_read: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
    )
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

    user: Mapped["User"] = relationship("User", lazy="select")  # type: ignore[name-defined]

    def to_dict(self) -> dict:
        return {
            "id": str(self.id),
            "user_id": str(self.user_id),
            "title": self.title,
            "body": self.body,
            "is_read": self.is_read,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }
