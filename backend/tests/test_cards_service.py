"""
Unit tests for app.blueprints.cards.service.move_card.

Each test verifies one scenario using a real PostgreSQL session that is
rolled back after the test so there is no cross-test state.

Scenarios covered
-----------------
1. Moving a card within the same column re-normalises positions correctly.
2. Moving a card to a different column updates column_id and re-normalises
   both the source and destination columns.
3. Passing a non-existent card_id raises CardNotFoundException.
4. Passing a column that belongs to another user raises ColumnNotFoundException.
5. After a move the sibling positions are exactly contiguous integers starting
   at 0 with no gaps or duplicates.
"""

import uuid

import pytest

from app.blueprints.cards.service import move_card
from app.common.exceptions import CardNotFoundException, ColumnNotFoundException
from app.extensions import db
from app.models.card import Card


# ---------------------------------------------------------------------------
# Test 1 — move within the same column
# ---------------------------------------------------------------------------

def test_move_card_same_column(app_ctx, db_session, make_user, make_board, make_column, make_card):
    """Moving a card within its column keeps column_id unchanged and leaves
    all positions contiguous from 0."""
    user = make_user()
    board = make_board(user)
    col = make_column(board)

    card_a = make_card(col, user, order=0)
    card_b = make_card(col, user, order=1)
    card_c = make_card(col, user, order=2)

    result = move_card(user, card_c.id, col.id, 0)

    assert result.column_id == col.id

    cards = db_session.execute(
        db.select(Card)
        .where(Card.column_id == col.id)
        .order_by(Card.order.asc())
    ).scalars().all()

    positions = [c.order for c in cards]
    assert positions == list(range(len(positions))), (
        f"Order values are not contiguous: {positions}"
    )
    assert len(positions) == 3


# ---------------------------------------------------------------------------
# Test 2 — move to a different column
# ---------------------------------------------------------------------------

def test_move_card_different_column(app_ctx, db_session, make_user, make_board, make_column, make_card):
    """Moving a card to a different column updates column_id and leaves both
    the source and destination columns with contiguous positions."""
    user = make_user()
    board = make_board(user)
    col_a = make_column(board, position=0)
    col_b = make_column(board, position=1)

    card_a0 = make_card(col_a, user, order=0)
    card_a1 = make_card(col_a, user, order=1)
    card_b0 = make_card(col_b, user, order=0)

    # Move col_a's first card to col_b at position 0.
    result = move_card(user, card_a0.id, col_b.id, 0)

    assert result.column_id == col_b.id

    # col_a should have exactly 1 card remaining at order 0.
    col_a_cards = db_session.execute(
        db.select(Card)
        .where(Card.column_id == col_a.id)
        .order_by(Card.order.asc())
    ).scalars().all()

    assert [c.order for c in col_a_cards] == [0], (
        f"col_a order after move: {[c.order for c in col_a_cards]}"
    )

    # col_b should have 2 cards with contiguous order values [0, 1].
    col_b_cards = db_session.execute(
        db.select(Card)
        .where(Card.column_id == col_b.id)
        .order_by(Card.order.asc())
    ).scalars().all()

    assert [c.order for c in col_b_cards] == [0, 1], (
        f"col_b order after move: {[c.order for c in col_b_cards]}"
    )


# ---------------------------------------------------------------------------
# Test 3 — card not found
# ---------------------------------------------------------------------------

def test_move_card_not_found(app_ctx, db_session, make_user):
    """Passing a card_id that does not exist raises CardNotFoundException."""
    user = make_user()

    with pytest.raises(CardNotFoundException):
        move_card(user, uuid.uuid4(), uuid.uuid4(), 0)


# ---------------------------------------------------------------------------
# Test 4 — column belongs to a different user
# ---------------------------------------------------------------------------

def test_move_card_wrong_user_column_raises_column_not_found(
    app_ctx, db_session, make_user, make_board, make_column, make_card
):
    """When the destination column belongs to another user's board,
    _get_owned_column raises ColumnNotFoundException (not
    UnauthorizedBoardAccessError) because the query finds nothing for the
    calling user."""
    user_a = make_user()
    user_b = make_user()

    # user_a owns a board with a column and a card.
    board_a = make_board(user_a)
    col_a = make_column(board_a)
    card = make_card(col_a, user_a, order=0)

    # user_b owns a separate board with its own column.
    board_b = make_board(user_b)
    col_b = make_column(board_b)

    # user_a tries to move their card into user_b's column.
    with pytest.raises(ColumnNotFoundException):
        move_card(user_a, card.id, col_b.id, 0)


# ---------------------------------------------------------------------------
# Test 5 — exact renormalised positions after move
# ---------------------------------------------------------------------------

def test_move_card_renormalised_positions(
    app_ctx, db_session, make_user, make_board, make_column, make_card
):
    """After moving a card the sibling order values must be exactly
    [0, 1, 2, 3] — contiguous, no gaps, no duplicates."""
    user = make_user()
    board = make_board(user)
    col = make_column(board)

    card_0 = make_card(col, user, order=0)
    card_1 = make_card(col, user, order=1)
    card_2 = make_card(col, user, order=2)
    card_3 = make_card(col, user, order=3)

    # Move the card currently at order 0 to order 3 (the end).
    move_card(user, card_0.id, col.id, 3)

    cards = db_session.execute(
        db.select(Card)
        .where(Card.column_id == col.id)
        .order_by(Card.order.asc())
    ).scalars().all()

    positions = sorted(c.order for c in cards)
    assert positions == [0, 1, 2, 3], (
        f"Expected [0, 1, 2, 3] but got {positions}"
    )
    assert len(set(positions)) == 4, "Order values contain duplicates"
