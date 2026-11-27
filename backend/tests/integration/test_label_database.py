"""Database-level tests for labels and card_labels (PostgreSQL)."""
from datetime import datetime, timezone

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DataError, IntegrityError

from app.models.card import Card
from app.models.label import Label


def _insert_label(db_session, board, name, color="blue"):
    with db_session.begin_nested():
        db_session.add(Label(board_id=board.id, name=name, color=color))
        db_session.flush()


def _count(db_session, table):
    return db_session.execute(text(f"select count(*) from {table}")).scalar()


def test_unique_lower_name_per_board(db_session, make_user, make_board):
    board = make_board(make_user())
    _insert_label(db_session, board, "Bug")

    with pytest.raises(IntegrityError) as excinfo:
        _insert_label(db_session, board, "bUG")

    assert "uq_labels_board_id_lower_name" in str(excinfo.value)


def test_same_name_allowed_on_different_boards(db_session, make_user, make_board):
    user = make_user()
    _insert_label(db_session, make_board(user, name="A"), "Bug")
    _insert_label(db_session, make_board(user, name="B"), "Bug")

    assert _count(db_session, "labels") == 2


@pytest.mark.parametrize("color", ["pink", "", "BLUE"])
def test_color_check_constraint(db_session, make_user, make_board, color):
    board = make_board(make_user())

    with pytest.raises(IntegrityError) as excinfo:
        _insert_label(db_session, board, "x", color=color)

    assert "ck_labels_color" in str(excinfo.value)


@pytest.mark.parametrize("name", ["", "   "])
def test_name_check_constraint_rejects_blank(db_session, make_user, make_board, name):
    board = make_board(make_user())

    with pytest.raises(IntegrityError) as excinfo:
        _insert_label(db_session, board, name)

    assert "ck_labels_name_not_blank" in str(excinfo.value)


def test_name_longer_than_50_characters_is_rejected(db_session, make_user, make_board):
    board = make_board(make_user())

    with pytest.raises(DataError):
        _insert_label(db_session, board, "a" * 51)


def test_card_labels_composite_primary_key_rejects_duplicates(
    db_session, make_user, make_board, make_column, make_card, make_label
):
    user = make_user()
    board = make_board(user)
    card = make_card(make_column(board), user)
    label = make_label(board)
    insert = text("insert into card_labels (card_id, label_id) values (:c, :l)")
    params = {"c": card.id, "l": label.id}
    db_session.execute(insert, params)

    with pytest.raises(IntegrityError) as excinfo:
        with db_session.begin_nested():
            db_session.execute(insert, params)

    assert "pk_card_labels" in str(excinfo.value)


def test_card_labels_foreign_keys_reject_unknown_ids(db_session, make_user, make_board, make_column, make_card):
    import uuid

    user = make_user()
    card = make_card(make_column(make_board(user)), user)

    with pytest.raises(IntegrityError) as excinfo:
        with db_session.begin_nested():
            db_session.execute(
                text("insert into card_labels (card_id, label_id) values (:c, :l)"),
                {"c": card.id, "l": uuid.uuid4()},
            )

    assert "fk_card_labels_label_id_labels" in str(excinfo.value)


def test_deleting_a_label_removes_associations_but_keeps_cards(
    db_session, make_user, make_board, make_column, make_card, make_label, attach_label
):
    user = make_user()
    board = make_board(user)
    card = make_card(make_column(board), user)
    keep = make_label(board, name="keep")
    drop = make_label(board, name="drop")
    attach_label(card, keep, drop)
    assert _count(db_session, "card_labels") == 2

    db_session.delete(drop)
    db_session.flush()
    db_session.expire_all()

    assert _count(db_session, "card_labels") == 1
    assert db_session.get(Card, card.id) is not None
    assert [l.name for l in db_session.get(Card, card.id).labels] == ["keep"]


def test_deleting_a_board_removes_labels_and_associations(
    db_session, make_user, make_board, make_column, make_card, make_label, attach_label
):
    user = make_user()
    board = make_board(user)
    card = make_card(make_column(board), user)
    attach_label(card, make_label(board))

    db_session.delete(board)
    db_session.flush()

    assert _count(db_session, "labels") == 0
    assert _count(db_session, "card_labels") == 0


def test_soft_deleted_card_keeps_its_association_rows(
    db_session, make_user, make_board, make_column, make_card, make_label, attach_label
):
    user = make_user()
    board = make_board(user)
    card = make_card(make_column(board), user)
    attach_label(card, make_label(board))

    card.deleted_at = datetime.now(timezone.utc)
    db_session.flush()

    assert _count(db_session, "card_labels") == 1
    assert _count(db_session, "labels") == 1


def test_deleting_a_card_row_removes_its_associations_only(
    db_session, make_user, make_board, make_column, make_card, make_label, attach_label
):
    user = make_user()
    board = make_board(user)
    card = make_card(make_column(board), user)
    label = make_label(board)
    attach_label(card, label)

    db_session.delete(card)
    db_session.flush()

    assert _count(db_session, "card_labels") == 0
    assert _count(db_session, "labels") == 1
