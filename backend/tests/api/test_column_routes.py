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
