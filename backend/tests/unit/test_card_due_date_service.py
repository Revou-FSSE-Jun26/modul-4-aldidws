"""Service-level tests for ``due_date`` on cards."""
from datetime import datetime, timezone

from app.blueprints.cards.service import create_card, move_card, update_card

DUE = datetime(2027, 3, 4, 5, 6, 7, tzinfo=timezone.utc)


def test_create_card_stores_due_date(app_ctx, make_user, make_board, make_column):
    user = make_user()
    col = make_column(make_board(user))

    card = create_card(user, col.id, {"title": "T", "due_date": DUE})

    assert card.due_date == DUE


def test_update_card_omitted_keeps_and_null_clears(
    app_ctx, make_user, make_board, make_column, make_card
):
    user = make_user()
    card = make_card(make_column(make_board(user)), user)
    card.due_date = DUE

    update_card(user, card.id, {"title": "New"})
    assert card.due_date == DUE

    update_card(user, card.id, {"due_date": None})
    assert card.due_date is None


def test_move_card_keeps_due_date(app_ctx, make_user, make_board, make_column, make_card):
    user = make_user()
    board = make_board(user)
    col_a = make_column(board, position=0)
    col_b = make_column(board, position=1)
    card = make_card(col_a, user, order=0)
    card.due_date = DUE

    result = move_card(user, card.id, col_b.id, 0)

    assert result.column_id == col_b.id
    assert result.due_date == DUE
