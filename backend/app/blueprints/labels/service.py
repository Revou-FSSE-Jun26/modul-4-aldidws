"""
Labels service.

Business logic for board labels and card-label assignment.  Independent of
Flask request/response objects; raises typed ``AppException`` subclasses.
Ownership is always resolved through the owning board.
"""
import uuid

from sqlalchemy import func
from sqlalchemy.exc import IntegrityError

from app.access import get_board_for_user, get_card_for_user
from app.blueprints.cards.service import get_owned_card
from app.common.exceptions import LabelNotFoundException, ResourceConflictException
from app.extensions import db
from app.models.board import Board
from app.models.board_column import BoardColumn
from app.models.label import Label

_CONFLICT_MESSAGE = "A label with that name already exists."


def _get_owned_label(current_user, label_id: uuid.UUID) -> Label:
    """Return a label the caller may *write* to (board owner), or raise 404."""
    label = db.session.execute(
        db.select(Label)
        .join(Board, Label.board_id == Board.id)
        .where(Label.id == label_id)
    ).scalar_one_or_none()
    if label is None:
        raise LabelNotFoundException()
    # Write access: only the board owner.
    get_board_for_user(current_user, label.board_id, write=True)
    return label


def _check_name_conflict(board_id: uuid.UUID, name: str, exclude_id=None) -> None:
    query = db.select(Label.id).where(
        Label.board_id == board_id,
        func.lower(Label.name) == name.lower(),
    )
    if exclude_id is not None:
        query = query.where(Label.id != exclude_id)
    if db.session.execute(query).first() is not None:
        raise ResourceConflictException(message=_CONFLICT_MESSAGE)


def _commit_or_conflict() -> None:
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        raise ResourceConflictException(message=_CONFLICT_MESSAGE) from None
    except Exception:
        db.session.rollback()
        raise


def list_labels(current_user, board_id: uuid.UUID) -> list[Label]:
    """Return the labels of a board the caller may access (members included)."""
    board = get_board_for_user(current_user, board_id)
    return list(
        db.session.execute(db.select(Label).where(Label.board_id == board.id)).scalars().all()
    )


def create_label(current_user, board_id: uuid.UUID, data: dict) -> Label:
    """Create a label on a board; owner only; 409 on a name clash."""
    board = get_board_for_user(current_user, board_id, write=True)
    _check_name_conflict(board.id, data["name"])
    label = Label(board_id=board.id, name=data["name"], color=data["color"])
    db.session.add(label)
    _commit_or_conflict()
    return label


def update_label(current_user, label_id: uuid.UUID, data: dict) -> Label:
    """Rename and/or recolour an owned label."""
    label = _get_owned_label(current_user, label_id)
    if "name" in data:
        _check_name_conflict(label.board_id, data["name"], exclude_id=label.id)
        label.name = data["name"]
    if "color" in data:
        label.color = data["color"]
    _commit_or_conflict()
    return label


def delete_label(current_user, label_id: uuid.UUID) -> None:
    """Hard-delete an owned label; the database removes its card associations."""
    label = _get_owned_label(current_user, label_id)
    try:
        db.session.delete(label)
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise


def set_card_labels(current_user, card_id: uuid.UUID, label_ids: list[uuid.UUID]):
    """Replace the labels of a card with labels of the card's own board.

    Write access: card creator or board owner (via the access layer).
    """
    card = get_card_for_user(current_user, card_id, write=True)
    board_id = db.session.execute(
        db.select(BoardColumn.board_id).where(BoardColumn.id == card.column_id)
    ).scalar_one()
    labels = []
    if label_ids:
        labels = list(
            db.session.execute(
                db.select(Label).where(Label.id.in_(label_ids), Label.board_id == board_id)
            ).scalars().all()
        )
        if len(labels) != len(label_ids):
            raise LabelNotFoundException()
    card.labels = labels
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        raise LabelNotFoundException() from None
    except Exception:
        db.session.rollback()
        raise
    return card
