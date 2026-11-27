"""
CardAssignee association model.

Links users (board members) to specific cards they are "tagged on".
Only the board owner manages tags (``PATCH /api/v1/cards/{id}/assignees``);
a user tagged on a card may move that card, just like the card's creator
and the board owner.  Rows cascade when either the card or the user is
deleted.
"""
import uuid

from sqlalchemy import (
    ForeignKeyConstraint,
    Index,
    PrimaryKeyConstraint,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.extensions import db


class CardAssignee(db.Model):
    """A tag linking a user to a card they are allowed to move.

    Composite primary key ``(card_id, user_id)``; no surrogate id needed.
    """

    __tablename__ = "card_assignees"

    __table_args__ = (
        PrimaryKeyConstraint("card_id", "user_id", name="pk_card_assignees"),
        ForeignKeyConstraint(
            ["card_id"], ["cards.id"], ondelete="CASCADE", name="fk_card_assignees_card_id_cards"
        ),
        ForeignKeyConstraint(
            ["user_id"], ["users.id"], ondelete="CASCADE", name="fk_card_assignees_user_id_users"
        ),
        Index("ix_card_assignees_user_id", "user_id"),
    )

    card_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), nullable=False)
