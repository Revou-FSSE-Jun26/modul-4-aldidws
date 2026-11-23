"""
User model.

Represents an authenticated account.  Every board, column, card, and comment
is ultimately owned by a user.  Passwords are stored as hashes only — the
plaintext is never persisted.

Security note: ``password_hash`` is intentionally excluded from ``to_dict``
so it can never leak through API serialization.
"""

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Index,
    String,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.extensions import db


class User(db.Model):
    """An authenticated application user.

    Columns
    -------
    id:
        UUID primary key, application-generated.
    email:
        Unique login identity.  Stored and compared lower-cased in the
        service layer; the unique constraint enforces uniqueness at the
        database level.
    password_hash:
        PBKDF2-SHA256 hash produced by ``werkzeug.security``.  Never
        returned through the API.
    timezone:
        IANA timezone string (e.g. ``"UTC"``, ``"America/New_York"``).
        Used when evaluating due-date comparisons in the user's local day.
    role:
        ``"member"`` (default) or ``"admin"``.  Drives role-based access
        control in the service layer.
    is_active:
        Soft-disable flag.  Inactive users are rejected at the auth
        boundary without exposing the reason.
    created_at / updated_at:
        UTC timestamps managed by the database.
    """

    __tablename__ = "users"

    __table_args__ = (
        # Case-insensitive uniqueness is enforced by the service layer
        # (lower-casing before lookup) and backed by this unique index on
        # the raw column.  A functional index on lower(email) would be
        # stronger but requires a PostgreSQL-only migration; this provides
        # the integrity guarantee for now.
        Index("ix_users_email", "email", unique=True),
        CheckConstraint(
            "role IN ('member', 'admin')",
            name="ck_users_role_valid",
        ),
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
    # Identity columns
    # ------------------------------------------------------------------

    email: Mapped[str] = mapped_column(
        String(254),
        nullable=False,
    )

    password_hash: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    # ------------------------------------------------------------------
    # Profile columns
    # ------------------------------------------------------------------

    name: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    timezone: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        default="UTC",
        server_default="UTC",
    )

    role: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
        default="member",
        server_default="member",
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default="true",
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

    boards: Mapped[list["Board"]] = relationship(  # type: ignore[name-defined]  # noqa: F821
        "Board",
        back_populates="owner",
        lazy="select",
    )

    card_comments: Mapped[list["CardComment"]] = relationship(  # type: ignore[name-defined]  # noqa: F821
        "CardComment",
        back_populates="author",
        lazy="select",
    )

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def to_dict(self) -> dict:
        """Return a safe, serializable representation.

        ``password_hash`` is intentionally excluded.
        """
        return {
            "id": str(self.id),
            "email": self.email,
            "name": self.name,
            "timezone": self.timezone,
            "role": self.role,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }

    def __repr__(self) -> str:
        return f"<User id={self.id} email={self.email!r} role={self.role!r}>"
