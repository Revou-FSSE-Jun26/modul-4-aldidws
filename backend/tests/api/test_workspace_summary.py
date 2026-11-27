"""API tests for GET /api/users/me/summary (workspace summary endpoint)."""

from tests.conftest import make_jwt


def _auth(user) -> dict:
    return {"Authorization": f"Bearer {make_jwt(user.id)}"}


def test_summary_returns_correct_structure(client, make_user):
    user = make_user()

    response = client.get("/api/users/me/summary", headers=_auth(user))

    assert response.status_code == 200
    body = response.get_json()
    assert "data" in body
    assert body["meta"] is None
    data = body["data"]
    assert set(data) == {"workspace_name", "projects", "tasks", "members"}


def test_summary_zero_boards_zero_cards(client, make_user):
    user = make_user(email="zero@example.com")

    data = client.get("/api/users/me/summary", headers=_auth(user)).get_json()["data"]

    assert data["projects"] == 0
    assert data["tasks"] == 0
    assert data["members"] == 1


def test_summary_workspace_name_uses_user_name(client, make_user):
    user = make_user(email="named@example.com")
    user.name = "Alice"

    data = client.get("/api/users/me/summary", headers=_auth(user)).get_json()["data"]

    assert data["workspace_name"] == "Alice's workspace"


def test_summary_counts_boards_and_live_cards(
    client, make_user, make_board, make_column, make_card
):
    user = make_user(email="count@example.com")
    board1 = make_board(user, name="Board 1")
    board2 = make_board(user, name="Board 2")
    col1 = make_column(board1)
    col2 = make_column(board2)
    make_card(col1, user, title="Card A", order=0)
    make_card(col1, user, title="Card B", order=1)
    make_card(col2, user, title="Card C", order=0)

    data = client.get("/api/users/me/summary", headers=_auth(user)).get_json()["data"]

    assert data["projects"] == 2
    assert data["tasks"] == 3
    assert data["members"] == 1


def test_summary_excludes_soft_deleted_cards(
    client, db_session, make_user, make_board, make_column, make_card
):
    from datetime import datetime, timezone

    user = make_user(email="softdel@example.com")
    board = make_board(user, name="Board")
    col = make_column(board)
    make_card(col, user, title="live", order=0)
    deleted = make_card(col, user, title="deleted", order=1)
    deleted.deleted_at = datetime.now(timezone.utc)
    db_session.flush()

    data = client.get("/api/users/me/summary", headers=_auth(user)).get_json()["data"]

    assert data["tasks"] == 1


def test_summary_does_not_count_other_users_boards(
    client, make_user, make_board, make_column, make_card
):
    user = make_user(email="mine@example.com")
    other = make_user(email="other@example.com")
    make_board(other, name="Other Board")
    my_board = make_board(user, name="My Board")
    col = make_column(my_board)
    make_card(col, user, title="My Card", order=0)

    data = client.get("/api/users/me/summary", headers=_auth(user)).get_json()["data"]

    assert data["projects"] == 1
    assert data["tasks"] == 1


def test_summary_returns_401_without_token(client):
    response = client.get("/api/users/me/summary")

    assert response.status_code == 401
    assert "error" in response.get_json()
