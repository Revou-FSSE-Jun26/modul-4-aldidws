"""API tests for the board routes (read with columns and cards, create, delete)."""

from datetime import datetime, timezone

from sqlalchemy import event, select

from app.models.board_column import BoardColumn
from app.models.card import Card
from app.models.card_comment import CardComment
from tests.conftest import make_jwt


def _auth(user) -> dict:
    return {"Authorization": f"Bearer {make_jwt(user.id)}"}


BOARD_KEYS = {"id", "name", "user_id", "created_at", "updated_at", "columns"}
COLUMN_KEYS = {"id", "board_id", "name", "position", "created_at", "updated_at", "cards"}
CARD_KEYS = {
    "id", "column_id", "owner_id", "title", "description", "order",
    "deleted_at", "created_at", "updated_at",
}


def test_get_board_returns_columns_and_cards_in_order(
    client, make_user, make_board, make_column, make_card
):
    user = make_user()
    board = make_board(user, name="Kanban")
    col_b = make_column(board, name="Doing", position=1)
    col_a = make_column(board, name="Todo", position=0)
    make_card(col_a, user, title="second", order=1)
    make_card(col_a, user, title="first", order=0)
    make_card(col_b, user, title="other", order=0)

    response = client.get(f"/api/boards/{board.id}", headers=_auth(user))

    assert response.status_code == 200
    data = response.get_json()["data"]
    assert set(data) == BOARD_KEYS
    assert data["user_id"] == str(user.id)
    assert [c["name"] for c in data["columns"]] == ["Todo", "Doing"]
    for column in data["columns"]:
        assert set(column) == COLUMN_KEYS
        for card in column["cards"]:
            assert set(card) == CARD_KEYS
    assert [c["title"] for c in data["columns"][0]["cards"]] == ["first", "second"]
    assert [c["title"] for c in data["columns"][1]["cards"]] == ["other"]


def test_get_board_cards_with_equal_order_sorted_by_created_at(
    client, db_session, make_user, make_board, make_column, make_card
):
    user = make_user()
    board = make_board(user)
    col = make_column(board)
    newer = make_card(col, user, title="newer", order=0)
    older = make_card(col, user, title="older", order=0)
    # server_default now() is the transaction start time, so rows created in
    # one test transaction tie. Set distinct timestamps explicitly.
    older.created_at = datetime(2024, 1, 1, tzinfo=timezone.utc)
    newer.created_at = datetime(2024, 1, 2, tzinfo=timezone.utc)
    db_session.flush()

    data = client.get(f"/api/boards/{board.id}", headers=_auth(user)).get_json()["data"]

    assert [c["title"] for c in data["columns"][0]["cards"]] == ["older", "newer"]


def test_get_board_excludes_soft_deleted_cards(
    client, db_session, make_user, make_board, make_column, make_card
):
    user = make_user()
    board = make_board(user)
    col = make_column(board)
    make_card(col, user, title="live", order=0)
    gone = make_card(col, user, title="gone", order=1)
    gone.deleted_at = datetime.now(timezone.utc)
    db_session.flush()

    data = client.get(f"/api/boards/{board.id}", headers=_auth(user)).get_json()["data"]

    assert [c["title"] for c in data["columns"][0]["cards"]] == ["live"]


def test_get_empty_board_returns_no_columns(client, make_user, make_board):
    user = make_user()
    board = make_board(user)

    data = client.get(f"/api/boards/{board.id}", headers=_auth(user)).get_json()["data"]

    assert data["columns"] == []


def test_get_board_of_another_user_returns_404(client, make_user, make_board):
    owner = make_user()
    intruder = make_user()
    board = make_board(owner)

    response = client.get(f"/api/boards/{board.id}", headers=_auth(intruder))

    assert response.status_code == 404
    assert response.get_json()["error"]["code"] == "BOARD_NOT_FOUND"


def test_get_unknown_board_returns_404(client, make_user):
    import uuid

    user = make_user()

    response = client.get(f"/api/boards/{uuid.uuid4()}", headers=_auth(user))

    assert response.status_code == 404


def test_get_board_without_token_returns_401(client, make_user, make_board):
    board = make_board(make_user())

    response = client.get(f"/api/boards/{board.id}")

    assert response.status_code == 401
    assert "error" in response.get_json()


def test_get_board_uses_three_board_queries(
    client, db_session, make_user, make_board, make_column, make_card
):
    user = make_user()
    board = make_board(user)
    for i in range(3):
        col = make_column(board, position=i)
        make_card(col, user, order=0)
        make_card(col, user, order=1)
    headers = _auth(user)

    statements = []

    def _count(conn, cursor, statement, parameters, context, executemany):
        statements.append(statement)

    bind = db_session.get_bind()
    event.listen(bind, "before_cursor_execute", _count)
    try:
        response = client.get(f"/api/boards/{board.id}", headers=headers)
    finally:
        event.remove(bind, "before_cursor_execute", _count)

    assert response.status_code == 200
    board_reads = [
        s for s in statements
        if s.lstrip().upper().startswith("SELECT")
        and any(t in s for t in ("FROM boards", "FROM board_columns", "FROM cards"))
    ]
    assert len(board_reads) == 3, board_reads


def test_create_board_returns_201_and_plain_board(client, make_user):
    user = make_user()

    response = client.post("/api/boards", json={"name": "New"}, headers=_auth(user))

    assert response.status_code == 201
    data = response.get_json()["data"]
    assert set(data) == {"id", "name", "user_id", "created_at", "updated_at"}


def test_create_board_unknown_field_returns_400(client, make_user):
    user = make_user()

    response = client.post(
        "/api/boards", json={"name": "New", "color": "red"}, headers=_auth(user)
    )

    assert response.status_code == 400
    assert response.get_json()["error"]["code"] == "VALIDATION_ERROR"


def test_create_board_duplicate_name_is_case_insensitive_409(client, make_user, make_board):
    user = make_user()
    make_board(user, name="Roadmap")

    response = client.post("/api/boards", json={"name": "ROADMAP"}, headers=_auth(user))

    assert response.status_code == 409
    assert response.get_json()["error"]["code"] == "RESOURCE_CONFLICT"


def test_delete_board_cascades_and_keeps_other_users_data(
    client, db_session, make_user, make_board, make_column, make_card
):
    user = make_user()
    other = make_user()
    board = make_board(user)
    col = make_column(board)
    card = make_card(col, user)
    db_session.add(CardComment(card_id=card.id, author_id=user.id, body="hi"))
    other_board = make_board(other)
    other_col = make_column(other_board)
    other_card = make_card(other_col, other)
    db_session.flush()
    col_id, card_id, other_card_id = col.id, card.id, other_card.id

    response = client.delete(f"/api/boards/{board.id}", headers=_auth(user))

    assert response.status_code == 204
    db_session.expire_all()
    assert db_session.execute(select(BoardColumn).where(BoardColumn.id == col_id)).first() is None
    assert db_session.execute(select(Card).where(Card.id == card_id)).first() is None
    assert db_session.execute(select(CardComment)).first() is None
    assert db_session.execute(select(Card).where(Card.id == other_card_id)).first() is not None


def test_delete_board_of_another_user_returns_404(client, make_user, make_board):
    owner = make_user()
    intruder = make_user()
    board = make_board(owner)

    response = client.delete(f"/api/boards/{board.id}", headers=_auth(intruder))

    assert response.status_code == 404
