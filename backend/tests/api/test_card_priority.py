"""API tests for the cards.priority field (B3)."""

import uuid
import pytest
from tests.conftest import make_jwt

COLUMN_ID = "22222222-2222-4222-8222-222222222222"
CARD_ID = "33333333-3333-4333-8333-333333333333"


def _auth(user) -> dict:
    return {"Authorization": f"Bearer {make_jwt(user.id)}"}


@pytest.fixture()
def ctx(make_user, make_board, make_column, make_card):
    """Minimal board graph for priority tests."""
    import types

    user = make_user()
    board = make_board(user, name="Priority Board")
    col = make_column(board, name="Todo", position=0)
    card = make_card(col, user, title="Test Card", order=0)
    return types.SimpleNamespace(user=user, board=board, col=col, card=card)


# ---------------------------------------------------------------------------
# Create card – priority behaviour
# ---------------------------------------------------------------------------


def test_create_card_without_priority_returns_null_priority(client, ctx):
    """Omitting priority in the request body should produce priority: null."""
    resp = client.post(
        f"/api/v1/columns/{ctx.col.id}/cards",
        json={"title": "No priority card"},
        headers=_auth(ctx.user),
    )
    assert resp.status_code == 201
    data = resp.get_json()["data"]
    assert "priority" in data
    assert data["priority"] is None


@pytest.mark.parametrize("value", ["low", "medium", "high"])
def test_create_card_with_priority(client, ctx, value):
    """Cards created with an explicit priority should store and return it."""
    resp = client.post(
        f"/api/v1/columns/{ctx.col.id}/cards",
        json={"title": f"Card with {value} priority", "priority": value},
        headers=_auth(ctx.user),
    )
    assert resp.status_code == 201
    assert resp.get_json()["data"]["priority"] == value


def test_create_card_with_explicit_null_priority(client, ctx):
    """Sending priority: null explicitly should store null."""
    resp = client.post(
        f"/api/v1/columns/{ctx.col.id}/cards",
        json={"title": "Explicit null", "priority": None},
        headers=_auth(ctx.user),
    )
    assert resp.status_code == 201
    assert resp.get_json()["data"]["priority"] is None


def test_create_card_with_invalid_priority_returns_400(client, ctx):
    """An unrecognised priority value should return 400 VALIDATION_ERROR."""
    resp = client.post(
        f"/api/v1/columns/{ctx.col.id}/cards",
        json={"title": "Bad priority", "priority": "urgent"},
        headers=_auth(ctx.user),
    )
    assert resp.status_code == 400
    err = resp.get_json()["error"]
    assert err["code"] == "VALIDATION_ERROR"


# ---------------------------------------------------------------------------
# Update card – priority behaviour
# ---------------------------------------------------------------------------


def test_update_card_sets_priority(client, ctx):
    """PATCHing priority to a valid value should update and return it."""
    resp = client.patch(
        f"/api/v1/cards/{ctx.card.id}",
        json={"priority": "high"},
        headers=_auth(ctx.user),
    )
    assert resp.status_code == 200
    assert resp.get_json()["data"]["priority"] == "high"


def test_update_card_clears_priority_with_null(client, db_session, ctx):
    """PATCHing priority to null should clear it."""
    # First set a priority
    ctx.card.priority = "low"
    db_session.flush()

    resp = client.patch(
        f"/api/v1/cards/{ctx.card.id}",
        json={"priority": None},
        headers=_auth(ctx.user),
    )
    assert resp.status_code == 200
    assert resp.get_json()["data"]["priority"] is None


def test_update_card_omitting_priority_does_not_change_it(client, db_session, ctx):
    """When priority is absent from the PATCH body the stored value is preserved."""
    ctx.card.priority = "medium"
    db_session.flush()

    resp = client.patch(
        f"/api/v1/cards/{ctx.card.id}",
        json={"title": "New Title"},
        headers=_auth(ctx.user),
    )
    assert resp.status_code == 200
    data = resp.get_json()["data"]
    assert data["priority"] == "medium"
    assert data["title"] == "New Title"


# ---------------------------------------------------------------------------
# Priority appears in every card response surface
# ---------------------------------------------------------------------------


def test_board_detail_cards_include_priority(client, ctx):
    """The board detail read must include priority on every card."""
    resp = client.get(f"/api/boards/{ctx.board.id}", headers=_auth(ctx.user))
    assert resp.status_code == 200
    board_data = resp.get_json()["data"]
    cards = [c for col in board_data["columns"] for c in col["cards"]]
    assert len(cards) >= 1
    for card in cards:
        assert "priority" in card


def test_list_cards_include_priority(client, ctx):
    """GET /api/v1/cards must include priority on every card."""
    resp = client.get("/api/v1/cards", headers=_auth(ctx.user))
    assert resp.status_code == 200
    for card in resp.get_json()["data"]:
        assert "priority" in card


def test_card_position_response_includes_priority(client, db_session, ctx, make_column):
    """PATCH /<card_id>/position must include priority in the response."""
    ctx.card.priority = "high"
    db_session.flush()
    col2 = make_column(ctx.board, name="Done", position=1)

    resp = client.patch(
        f"/api/v1/cards/{ctx.card.id}/position",
        json={"column_id": str(col2.id), "order": 0},
        headers=_auth(ctx.user),
    )
    assert resp.status_code == 200
    data = resp.get_json()["data"]
    assert "priority" in data
    assert data["priority"] == "high"


def test_set_labels_response_includes_priority(client, db_session, ctx):
    """PUT /<card_id>/labels must include priority in the response."""
    ctx.card.priority = "low"
    db_session.flush()

    resp = client.put(
        f"/api/v1/cards/{ctx.card.id}/labels",
        json={"label_ids": []},
        headers=_auth(ctx.user),
    )
    assert resp.status_code == 200
    data = resp.get_json()["data"]
    assert "priority" in data
    assert data["priority"] == "low"


# ---------------------------------------------------------------------------
# Security
# ---------------------------------------------------------------------------


def test_no_token_still_gives_401(client, ctx):
    """Unauthenticated access to the create card endpoint must return 401."""
    resp = client.post(
        f"/api/v1/columns/{ctx.col.id}/cards",
        json={"title": "Should fail"},
    )
    assert resp.status_code == 401


def test_other_users_card_still_gives_404(client, ctx, make_user, make_board, make_column, make_card):
    """A user cannot see or modify another user's card; both return 404."""
    other_user = make_user()
    other_board = make_board(other_user)
    other_col = make_column(other_board)
    other_card = make_card(other_col, other_user, title="Other card")

    # Try to PATCH the other user's card as the original user
    resp = client.patch(
        f"/api/v1/cards/{other_card.id}",
        json={"priority": "high"},
        headers=_auth(ctx.user),
    )
    assert resp.status_code == 404
