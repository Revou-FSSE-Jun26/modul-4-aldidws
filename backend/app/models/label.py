"""
Label model and the ``card_labels`` association table.

A label belongs to one board and is attached to cards of that board through
``card_labels``.  Names are unique per board, case-insensitively, enforced by
a functional unique index.  Deleting a board, a card or a label removes the
association rows through the database ``ON DELETE CASCADE``.
"""
import uuid
from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    PrimaryKeyConstraint,
    String,
    Table,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.extensions import db

LABEL_COLORS = ("blue", "sky", "graphite", "silver", "red", "orange", "green", "purple")

card_labels = Table(
    "card_labels",
    db.metadata,
    Column("card_id", Uuid(as_uuid=True), nullable=False),
    Column("label_id", Uuid(as_uuid=True), nullable=False),
    PrimaryKeyConstraint("card_id", "label_id", name="pk_card_labels"),
    ForeignKeyConstraint(
        ["card_id"], ["cards.id"], name="fk_card_labels_card_id_cards", ondelete="CASCADE"
    ),
    ForeignKeyConstraint(
        ["label_id"], ["labels.id"], name="fk_card_labels_label_id_labels", ondelete="CASCADE"
    ),
    Index("ix_card_labels_label_id", "label_id"),
)


class Label(db.Model):
    """A coloured text tag defined per board."""

    __tablename__ = "labels"
    __table_args__ = (
        PrimaryKeyConstraint("id", name="pk_labels"),
        CheckConstraint(
            "color IN ('blue','sky','graphite','silver','red','orange','green','purple')",
            name="ck_labels_color",
        ),
        CheckConstraint(
            "length(btrim(name)) BETWEEN 1 AND 50",
            name="ck_labels_name_not_blank",
        ),
        Index(
            "uq_labels_board_id_lower_name",
            "board_id",
            func.lower(db.literal_column("name")),
            unique=True,
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), default=uuid.uuid4)
    board_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("boards.id", ondelete="CASCADE", name="fk_labels_board_id_boards"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    color: Mapped[str] = mapped_column(String(16), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    board: Mapped["Board"] = relationship(  # type: ignore[name-defined]  # noqa: F821
        "Board", back_populates="labels"
    )

    def __repr__(self) -> str:
        return f"<Label id={self.id} name={self.name!r} color={self.color}>"
