"""API tests for the column routes, focused on the delete rule."""

from datetime import datetime, timezone

from sqlalchemy import select

from app.models.board_column import BoardColumn
from tests.conftest import make_jwt


def _auth(user) -> dict:
    return {"Authorization": f"Bearer {make_jwt(user.id)}"}


def test_create_column_appends_and_returns_201(client, make_user, make_board, make_column):
    user = make_user()
    board = make_board(user)
    make_column(board, position=0)

    response = client.post(
        f"/api/boards/{board.id}/columns", json={"name": "Done"}, headers=_auth(user)
    )

    assert response.status_code == 201
    data = response.get_json()["data"]
    assert data["name"] == "Done"
    assert data["position"] == 1


def test_rename_column_returns_200(client, make_user, make_board, make_column):
    user = make_user()
    col = make_column(make_board(user), name="Old")

    response = client.patch(
        f"/api/columns/{col.id}", json={"name": "New"}, headers=_auth(user)
    )

    assert response.status_code == 200
    assert response.get_json()["data"]["name"] == "New"


def test_delete_column_with_live_card_returns_409_and_keeps_column(
    client, db_session, make_user, make_board, make_column, make_card
):
    user = make_user()
    col = make_column(make_board(user))
    make_card(col, user)
    col_id = col.id

    response = client.delete(f"/api/columns/{col_id}", headers=_auth(user))

    assert response.status_code == 409
    assert response.get_json()["error"]["code"] == "RESOURCE_CONFLICT"
    assert db_session.execute(select(BoardColumn).where(BoardColumn.id == col_id)).first() is not None


def test_delete_empty_column_returns_204(client, db_session, make_user, make_board, make_column):
    user = make_user()
    col = make_column(make_board(user))
    col_id = col.id

    response = client.delete(f"/api/columns/{col_id}", headers=_auth(user))

    assert response.status_code == 204
    db_session.expire_all()
    assert db_session.execute(select(BoardColumn).where(BoardColumn.id == col_id)).first() is None


def test_delete_column_with_only_soft_deleted_cards_returns_204(
    client, db_session, make_user, make_board, make_column, make_card
):
    user = make_user()
    col = make_column(make_board(user))
    card = make_card(col, user)
    card.deleted_at = datetime.now(timezone.utc)
    db_session.flush()

    response = client.delete(f"/api/columns/{col.id}", headers=_auth(user))

    assert response.status_code == 204


def test_delete_column_of_another_user_returns_404(client, make_user, make_board, make_column):
    owner = make_user()
    intruder = make_user()
    col = make_column(make_board(owner))

    response = client.delete(f"/api/columns/{col.id}", headers=_auth(intruder))

    assert response.status_code == 404


def test_delete_column_without_token_returns_401(client, make_user, make_board, make_column):
    col = make_column(make_board(make_user()))

    assert client.delete(f"/api/columns/{col.id}").status_code == 401


def _reorder(client, user, board, ids):
    return client.patch(
        f"/api/boards/{board.id}/columns/reorder",
        json={"ordered_ids": [str(i) for i in ids]},
        headers=_auth(user),
    )


def test_reorder_columns_persists_new_order_and_returns_200(
    client, make_user, make_board, make_column
):
    user = make_user()
    board = make_board(user)
    a = make_column(board, name="A", position=0)
    b = make_column(board, name="B", position=1)
    c = make_column(board, name="C", position=2)
    response = _reorder(client, user, board, [c.id, a.id, b.id])
    assert response.status_code == 200
    data = response.get_json()["data"]
    assert [(d["name"], d["position"]) for d in data] == [("C", 0), ("A", 1), ("B", 2)]
    detail = client.get(f"/api/boards/{board.id}", headers=_auth(user)).get_json()["data"]
    names = [col["name"] for col in sorted(detail["columns"], key=lambda x: x["position"])]
    assert names == ["C", "A", "B"]


def test_reorder_columns_rejects_partial_list_with_400(
    client, make_user, make_board, make_column
):
    user = make_user()
    board = make_board(user)
    a = make_column(board, position=0)
    make_column(board, position=1)
    response = _reorder(client, user, board, [a.id])
    assert response.status_code == 400
    assert response.get_json()["error"]["code"] == "VALIDATION_ERROR"


def test_reorder_columns_rejects_duplicate_ids_with_400(
    client, make_user, make_board, make_column
):
    user = make_user()
    board = make_board(user)
    a = make_column(board, position=0)
    make_column(board, position=1)
    assert _reorder(client, user, board, [a.id, a.id]).status_code == 400


def test_reorder_columns_rejects_column_of_another_board_with_404(
    client, make_user, make_board, make_column
):
    user = make_user()
    board = make_board(user)
    a = make_column(board, position=0)
    foreign = make_column(make_board(user), position=0)
    assert _reorder(client, user, board, [a.id, foreign.id]).status_code == 404


def test_reorder_columns_rejects_invalid_uuid_with_400(
    client, make_user, make_board, make_column
):
    user = make_user()
    board = make_board(user)
    make_column(board, position=0)
    response = client.patch(
        f"/api/boards/{board.id}/columns/reorder",
        json={"ordered_ids": ["not-a-uuid"]},
        headers=_auth(user),
    )
    assert response.status_code == 400


def test_reorder_columns_of_another_users_board_returns_404(
    client, make_user, make_board, make_column
):
    owner = make_user()
    intruder = make_user()
    board = make_board(owner)
    a = make_column(board, position=0)
    assert _reorder(client, intruder, board, [a.id]).status_code == 404


def test_reorder_columns_without_token_returns_401(client, make_user, make_board, make_column):
    board = make_board(make_user())
    a = make_column(board, position=0)
    response = client.patch(
        f"/api/boards/{board.id}/columns/reorder", json={"ordered_ids": [str(a.id)]}
    )
    assert response.status_code == 401


def test_new_column_defaults_color_null_and_is_done_false(client, make_user, make_board):
    user = make_user()
    board = make_board(user)
    response = client.post(f"/api/boards/{board.id}/columns", json={"name": "A"}, headers=_auth(user))
    assert response.status_code == 201
    data = response.get_json()["data"]
    assert data["color"] is None
    assert data["is_done"] is False


def test_create_column_accepts_color_and_is_done(client, make_user, make_board):
    user = make_user()
    board = make_board(user)
    response = client.post(
        f"/api/boards/{board.id}/columns",
        json={"name": "Done", "color": "green", "is_done": True},
        headers=_auth(user),
    )
    assert response.status_code == 201
    data = response.get_json()["data"]
    assert data["color"] == "green"
    assert data["is_done"] is True


def test_create_column_rejects_invalid_color(client, make_user, make_board):
    user = make_user()
    board = make_board(user)
    response = client.post(
        f"/api/boards/{board.id}/columns", json={"name": "A", "color": "purple"}, headers=_auth(user)
    )
    assert response.status_code == 400
    error = response.get_json()["error"]
    assert error["code"] == "VALIDATION_ERROR"
    assert "color" in error["details"]


def test_update_column_color_persists_for_each_valid_color(client, make_user, make_board, make_column):
    user = make_user()
    col = make_column(make_board(user))
    for color in ("gray", "blue", "orange", "green", "red"):
        response = client.patch(f"/api/columns/{col.id}", json={"color": color}, headers=_auth(user))
        assert response.status_code == 200
        assert response.get_json()["data"]["color"] == color


def test_update_column_null_color_resets_it(client, make_user, make_board, make_column):
    user = make_user()
    col = make_column(make_board(user))
    client.patch(f"/api/columns/{col.id}", json={"color": "red"}, headers=_auth(user))
    response = client.patch(f"/api/columns/{col.id}", json={"color": None}, headers=_auth(user))
    assert response.status_code == 200
    assert response.get_json()["data"]["color"] is None


def test_update_column_without_color_leaves_it_unchanged(client, make_user, make_board, make_column):
    user = make_user()
    col = make_column(make_board(user))
    client.patch(f"/api/columns/{col.id}", json={"color": "blue"}, headers=_auth(user))
    response = client.patch(f"/api/columns/{col.id}", json={"name": "Renamed"}, headers=_auth(user))
    assert response.status_code == 200
    assert response.get_json()["data"]["color"] == "blue"


def test_update_column_rejects_invalid_color(client, make_user, make_board, make_column):
    user = make_user()
    col = make_column(make_board(user))
    response = client.patch(f"/api/columns/{col.id}", json={"color": "#ff0000"}, headers=_auth(user))
    assert response.status_code == 400
    assert response.get_json()["error"]["code"] == "VALIDATION_ERROR"


def test_update_column_is_done_toggles_and_rejects_non_boolean(client, make_user, make_board, make_column):
    user = make_user()
    col = make_column(make_board(user))
    ok = client.patch(f"/api/columns/{col.id}", json={"is_done": True}, headers=_auth(user))
    assert ok.status_code == 200
    assert ok.get_json()["data"]["is_done"] is True
    for bad in ("yes", "true", 1, None):
        response = client.patch(f"/api/columns/{col.id}", json={"is_done": bad}, headers=_auth(user))
        assert response.status_code == 400, bad
        assert response.get_json()["error"]["code"] == "VALIDATION_ERROR"


def test_update_color_on_other_users_column_returns_404(client, make_user, make_board, make_column):
    owner = make_user()
    intruder = make_user()
    col = make_column(make_board(owner))
    response = client.patch(f"/api/columns/{col.id}", json={"color": "red"}, headers=_auth(intruder))
    assert response.status_code == 404
    assert client.patch(f"/api/columns/{col.id}", json={"color": "red"}).status_code == 401


def test_board_detail_and_reorder_include_color_and_is_done(client, make_user, make_board, make_column):
    user = make_user()
    board = make_board(user)
    first = make_column(board, position=0)
    second = make_column(board, position=1)
    client.patch(f"/api/columns/{first.id}", json={"color": "orange", "is_done": True}, headers=_auth(user))
    detail = client.get(f"/api/boards/{board.id}", headers=_auth(user)).get_json()["data"]
    assert detail["columns"][0]["color"] == "orange"
    assert detail["columns"][0]["is_done"] is True
    assert detail["columns"][1]["color"] is None
    reordered = client.patch(
        f"/api/boards/{board.id}/columns/reorder",
        json={"ordered_ids": [str(second.id), str(first.id)]},
        headers=_auth(user),
    ).get_json()["data"]
    assert all({"color", "is_done"} <= set(c) for c in reordered)
