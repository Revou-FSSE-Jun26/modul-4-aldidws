"""Service-level tests for labels (rules and IntegrityError mapping)."""
import uuid
from unittest.mock import patch

import pytest
from sqlalchemy.exc import IntegrityError

from app.blueprints.labels import service
from app.common.exceptions import (
    BoardNotFoundException,
    LabelNotFoundException,
    ResourceConflictException,
)
from app.extensions import db
from app.models.label import Label


def test_create_label_conflict_is_case_insensitive(app_ctx, make_user, make_board, make_label):
    user = make_user()
    board = make_board(user)
    make_label(board, name="Bug")

    with pytest.raises(ResourceConflictException):
        service.create_label(user, board.id, {"name": "bUG", "color": "red"})


def test_create_label_integrity_error_maps_to_conflict_and_rolls_back(
    app_ctx, make_user, make_board
):
    user = make_user()
    board = make_board(user)

    with patch.object(db.session, "commit", side_effect=IntegrityError("x", {}, Exception())):
        with patch.object(db.session, "rollback") as rollback:
            with pytest.raises(ResourceConflictException) as excinfo:
                service.create_label(user, board.id, {"name": "Race", "color": "red"})

    rollback.assert_called_once()
    assert excinfo.value.message == "A label with that name already exists."


def test_update_label_integrity_error_maps_to_conflict(app_ctx, make_user, make_board, make_label):
    user = make_user()
    label = make_label(make_board(user), name="One")

    with patch.object(db.session, "commit", side_effect=IntegrityError("x", {}, Exception())):
        with patch.object(db.session, "rollback"):
            with pytest.raises(ResourceConflictException):
                service.update_label(user, label.id, {"name": "Two"})


def test_list_labels_of_unowned_board_raises_not_found(app_ctx, make_user, make_board):
    owner, other = make_user(), make_user()
    board = make_board(owner)

    with pytest.raises(BoardNotFoundException):
        service.list_labels(other, board.id)


def test_update_and_delete_unowned_label_raise_not_found(app_ctx, make_user, make_board, make_label):
    owner, other = make_user(), make_user()
    label = make_label(make_board(owner))

    with pytest.raises(LabelNotFoundException):
        service.update_label(other, label.id, {"name": "x"})
    with pytest.raises(LabelNotFoundException):
        service.delete_label(other, label.id)
    assert db.session.get(Label, label.id) is not None


def test_set_card_labels_rejects_foreign_label_before_changing_anything(
    app_ctx, make_user, make_board, make_column, make_card, make_label, attach_label
):
    user = make_user()
    board = make_board(user)
    card = make_card(make_column(board), user)
    mine = make_label(board, name="mine")
    foreign = make_label(make_board(user, name="Other"), name="foreign")
    attach_label(card, mine)

    with pytest.raises(LabelNotFoundException):
        service.set_card_labels(user, card.id, [mine.id, foreign.id])

    assert [l.id for l in card.labels] == [mine.id]


def test_set_card_labels_integrity_error_maps_to_not_found(
    app_ctx, make_user, make_board, make_column, make_card, make_label
):
    user = make_user()
    board = make_board(user)
    card = make_card(make_column(board), user)
    label = make_label(board)

    with patch.object(db.session, "commit", side_effect=IntegrityError("x", {}, Exception())):
        with patch.object(db.session, "rollback"):
            with pytest.raises(LabelNotFoundException):
                service.set_card_labels(user, card.id, [label.id])


def test_set_card_labels_unknown_id_raises_not_found(
    app_ctx, make_user, make_board, make_column, make_card
):
    user = make_user()
    card = make_card(make_column(make_board(user)), user)

    with pytest.raises(LabelNotFoundException):
        service.set_card_labels(user, card.id, [uuid.uuid4()])
