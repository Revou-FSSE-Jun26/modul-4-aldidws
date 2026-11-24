"""API tests for the card routes under /api/v1."""

import uuid

from sqlalchemy import select

from app.models.card import Card
from tests.conftest import make_jwt


def _auth(user) -> dict:
    return {"Authorization": f"Bearer {make_jwt(user.id)}"}


def test_create_card_returns_201(client, make_user, make_board, make_column):
    user = make_user()
    col = make_column(make_board(user))

    response = client.post(
        f"/api/v1/columns/{col.id}/cards", json={"title": "Task"}, headers=_auth(user)
    )

    assert response.status_code == 201
    data = response.get_json()["data"]
    assert data["title"] == "Task"
    assert data["order"] == 0


def test_create_card_in_another_users_column_returns_404(client, make_user, make_board, make_column):
    col = make_column(make_board(make_user()))
    intruder = make_user()

    response = client.post(
        f"/api/v1/columns/{col.id}/cards", json={"title": "Task"}, headers=_auth(intruder)
    )

    assert response.status_code == 404


def test_update_card_returns_200(client, make_user, make_board, make_column, make_card):
    user = make_user()
    card = make_card(make_column(make_board(user)), user, title="Old")

    response = client.patch(
        f"/api/v1/cards/{card.id}", json={"title": "New"}, headers=_auth(user)
    )

    assert response.status_code == 200
    assert response.get_json()["data"]["title"] == "New"


def test_delete_card_soft_deletes_and_repeat_returns_404(
    client, db_session, make_user, make_board, make_column, make_card
):
    user = make_user()
    card = make_card(make_column(make_board(user)), user)
    card_id = card.id

    first = client.delete(f"/api/v1/cards/{card_id}", headers=_auth(user))
    second = client.delete(f"/api/v1/cards/{card_id}", headers=_auth(user))

    assert first.status_code == 204
    assert second.status_code == 404
    db_session.expire_all()
    row = db_session.execute(select(Card).where(Card.id == card_id)).scalar_one()
    assert row.deleted_at is not None


def test_deleted_card_is_hidden_from_edit_move_comments_and_analytics(
    client, db_session, make_user, make_board, make_column, make_card
):
    user = make_user()
    board = make_board(user)
    col = make_column(board)
    other_col = make_column(board, position=1)
    card = make_card(col, user)
    make_card(col, user, order=1)
    headers = _auth(user)
    client.delete(f"/api/v1/cards/{card.id}", headers=headers)

    patch = client.patch(f"/api/v1/cards/{card.id}", json={"title": "x"}, headers=headers)
    move = client.patch(
        f"/api/v1/cards/{card.id}/position",
        json={"column_id": str(other_col.id), "order": 0},
        headers=headers,
    )
    post_comment = client.post(
        f"/api/cards/{card.id}/comments", json={"body": "hi"}, headers=headers
    )
    list_comments = client.get(f"/api/cards/{card.id}/comments", headers=headers)
    analytics = client.get(f"/api/analytics/boards/{board.id}/summary", headers=headers)

    assert patch.status_code == 404
    assert move.status_code == 404
    assert post_comment.status_code == 404
    assert list_comments.status_code == 404
    assert analytics.status_code == 200
    assert analytics.get_json()["data"]["total_cards"] == 1


def test_other_users_card_returns_404_for_update_delete_move(
    client, make_user, make_board, make_column, make_card
):
    owner = make_user()
    intruder = make_user()
    board = make_board(owner)
    col = make_column(board)
    card = make_card(col, owner)
    headers = _auth(intruder)

    assert client.patch(f"/api/v1/cards/{card.id}", json={"title": "x"}, headers=headers).status_code == 404
    assert client.delete(f"/api/v1/cards/{card.id}", headers=headers).status_code == 404
    assert client.patch(
        f"/api/v1/cards/{card.id}/position",
        json={"column_id": str(col.id), "order": 0},
        headers=headers,
    ).status_code == 404


def test_move_card_returns_200_with_payload(client, make_user, make_board, make_column, make_card):
    user = make_user()
    board = make_board(user)
    col_a = make_column(board, position=0)
    col_b = make_column(board, position=1)
    card = make_card(col_a, user)

    response = client.patch(
        f"/api/v1/cards/{card.id}/position",
        json={"column_id": str(col_b.id), "order": 0},
        headers=_auth(user),
    )

    assert response.status_code == 200
    data = response.get_json()["data"]
    assert data["column_id"] == str(col_b.id)
    assert data["order"] == 0


def test_move_card_with_position_field_returns_400(client, make_user, make_board, make_column, make_card):
    user = make_user()
    col = make_column(make_board(user))
    card = make_card(col, user)

    response = client.patch(
        f"/api/v1/cards/{card.id}/position",
        json={"column_id": str(col.id), "position": 0},
        headers=_auth(user),
    )

    assert response.status_code == 400
    assert response.get_json()["error"]["code"] == "VALIDATION_ERROR"


def test_move_card_tie_puts_moved_card_first(client, make_user, make_board, make_column, make_card):
    user = make_user()
    board = make_board(user)
    col_a = make_column(board, position=0)
    col_b = make_column(board, position=1)
    existing = make_card(col_b, user, title="existing", order=0)
    moving = make_card(col_a, user, title="moving", order=0)

    response = client.patch(
        f"/api/v1/cards/{moving.id}/position",
        json={"column_id": str(col_b.id), "order": 0},
        headers=_auth(user),
    )
    board_data = client.get(f"/api/boards/{board.id}", headers=_auth(user)).get_json()["data"]

    assert response.status_code == 200
    col_b_cards = board_data["columns"][1]["cards"]
    assert [c["title"] for c in col_b_cards] == ["moving", "existing"]
    assert [c["order"] for c in col_b_cards] == [0, 1]
    assert existing.id is not None


def test_move_card_to_other_users_column_returns_404(client, make_user, make_board, make_column, make_card):
    user = make_user()
    card = make_card(make_column(make_board(user)), user)
    foreign_col = make_column(make_board(make_user()))

    response = client.patch(
        f"/api/v1/cards/{card.id}/position",
        json={"column_id": str(foreign_col.id), "order": 0},
        headers=_auth(user),
    )

    assert response.status_code == 404


def test_card_routes_require_token(client):
    cid = uuid.uuid4()

    assert client.patch(f"/api/v1/cards/{cid}", json={"title": "x"}).status_code == 401
    assert client.delete(f"/api/v1/cards/{cid}").status_code == 401
