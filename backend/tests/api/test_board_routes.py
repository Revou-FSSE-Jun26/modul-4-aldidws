"""API tests for the board routes (read with columns and cards, create, delete)."""

from datetime import datetime, timezone

import pytest
from sqlalchemy import select

from app.models.board_column import BoardColumn
from app.models.card import Card
from app.models.card_comment import CardComment
from tests.conftest import count_selects, make_jwt


def _auth(user) -> dict:
    return {"Authorization": f"Bearer {make_jwt(user.id)}"}


BOARD_KEYS = {
    "id", "name", "user_id", "is_favorite", "created_at", "updated_at",
    "columns", "labels", "role", "access", "members",
}
LIST_BOARD_KEYS = {
    "id", "name", "user_id", "is_favorite", "created_at", "updated_at", "role",
}
COLUMN_KEYS = {
    "id", "board_id", "name", "position", "color", "is_done", "created_at", "updated_at", "cards"
}
CARD_KEYS = {
    "id", "column_id", "owner_id", "title", "description", "order", "due_date", "priority",
    "labels", "deleted_at", "created_at", "updated_at", "can_move",
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


@pytest.mark.parametrize(
    "columns, cards_per_column, label_count",
    [(3, 2, 3), (5, 6, 8), (2, 2, 200)],
)
def test_get_board_uses_seven_queries_regardless_of_size(
    client, db_session, make_user, make_board, make_column, make_card, make_label,
    attach_label, columns, cards_per_column, label_count,
):
    """The board detail endpoint must stay in O(1) reads regardless of size.

    Seven SELECT statements total:
    1. boards      (access check)
    2. board_columns
    3. cards (with labels joined)
    4. labels
    5. board_members (with users)
    6. card_assignees (tagged-card scan)
    7. card_assignees (second check when the first is non-empty —
       the can_move flag is derived from the single set built in step 6;
       when there is no tagged scan, a single query is enough)
    """
    user = make_user()
    board = make_board(user)
    labels = [make_label(board, name=f"L{i:03d}") for i in range(label_count)]
    for i in range(columns):
        col = make_column(board, position=i)
        for j in range(cards_per_column):
            card = make_card(col, user, order=j)
            attach_label(card, labels[(i + j) % len(labels)], labels[(i + j + 1) % len(labels)])
    headers = _auth(user)

    response, reads = count_selects(
        db_session, lambda: client.get(f"/api/boards/{board.id}", headers=headers)
    )

    assert response.status_code == 200
    assert len(response.get_json()["data"]["labels"]) == label_count
    assert len(reads) == 7, reads


def test_get_board_returns_sorted_labels_on_board_and_cards(
    client, make_user, make_board, make_column, make_card, make_label, attach_label
):
    user = make_user()
    board = make_board(user)
    col = make_column(board)
    card = make_card(col, user)
    bravo = make_label(board, name="bravo", color="red")
    alpha = make_label(board, name="Alpha", color="blue")
    attach_label(card, bravo, alpha)

    data = client.get(f"/api/boards/{board.id}", headers=_auth(user)).get_json()["data"]

    assert [l["name"] for l in data["labels"]] == ["Alpha", "bravo"]
    assert data["columns"][0]["cards"][0]["labels"] == [
        {"id": str(alpha.id), "name": "Alpha", "color": "blue"},
        {"id": str(bravo.id), "name": "bravo", "color": "red"},
    ]


def test_create_board_returns_201_and_plain_board(client, make_user):
    user = make_user()

    response = client.post("/api/boards", json={"name": "New"}, headers=_auth(user))

    assert response.status_code == 201
    data = response.get_json()["data"]
    assert set(data) == {"id", "name", "user_id", "is_favorite", "created_at", "updated_at"}


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


# ---------------------------------------------------------------------------
# is_favorite tests
# ---------------------------------------------------------------------------


def test_board_list_includes_is_favorite_and_role_fields(
    client, make_user, make_board, make_board_member
):
    user = make_user()
    owner_board = make_board(user, name="Owned")
    make_board_member(owner_board, user, role="owner")
    other = make_user()
    member_board = make_board(other, name="Shared")
    make_board_member(member_board, user, role="member")

    data = client.get("/api/boards", headers=_auth(user)).get_json()["data"]

    assert {row["name"]: row["role"] for row in data} == {"Owned": "owner", "Shared": "member"}
    for row in data:
        assert "is_favorite" in row
        assert row["is_favorite"] is False


def test_board_detail_includes_is_favorite_field(client, make_user, make_board):
    user = make_user()
    board = make_board(user, name="B")

    data = client.get(f"/api/boards/{board.id}", headers=_auth(user)).get_json()["data"]

    assert "is_favorite" in data
    assert data["is_favorite"] is False


def test_patch_board_toggles_is_favorite_true(client, make_user, make_board):
    user = make_user()
    board = make_board(user, name="C")

    response = client.patch(
        f"/api/boards/{board.id}",
        json={"is_favorite": True},
        headers=_auth(user),
    )

    assert response.status_code == 200
    assert response.get_json()["data"]["is_favorite"] is True


def test_patch_board_toggles_is_favorite_false(client, make_user, make_board, db_session):
    user = make_user()
    board = make_board(user, name="D")
    board.is_favorite = True
    db_session.flush()

    response = client.patch(
        f"/api/boards/{board.id}",
        json={"is_favorite": False},
        headers=_auth(user),
    )

    assert response.status_code == 200
    assert response.get_json()["data"]["is_favorite"] is False


def test_patch_board_is_favorite_invalid_value_returns_400(client, make_user, make_board):
    user = make_user()
    board = make_board(user, name="E")

    response = client.patch(
        f"/api/boards/{board.id}",
        json={"is_favorite": "yes"},
        headers=_auth(user),
    )

    assert response.status_code == 400
    assert response.get_json()["error"]["code"] == "VALIDATION_ERROR"
