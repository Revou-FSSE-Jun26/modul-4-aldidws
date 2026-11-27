"""API tests for the board-members routes.

- POST /api/boards/{board_id}/members            invite a member
- GET  /api/boards/{board_id}/members            list members
- DELETE /api/boards/{board_id}/members/{user_id} remove a member
- PATCH /api/v1/cards/{card_id}/assignees         set card tags
"""

import uuid

from tests.conftest import make_jwt


def _auth(user) -> dict:
    return {"Authorization": f"Bearer {make_jwt(user.id)}"}


def test_invite_member_returns_201(
    client, make_user, make_board, make_board_member
):
    owner = make_user(email="o@example.com")
    other = make_user(email="other@example.com")
    board = make_board(owner)

    response = client.post(
        f"/api/boards/{board.id}/members",
        json={"email": "other@example.com"},
        headers=_auth(owner),
    )

    assert response.status_code == 201
    assert response.get_json()["data"]["role"] == "member"


def test_invite_unknown_email_returns_404(
    client, make_user, make_board
):
    owner = make_user()
    board = make_board(owner)

    response = client.post(
        f"/api/boards/{board.id}/members",
        json={"email": "ghost@example.com"},
        headers=_auth(owner),
    )

    assert response.status_code == 404
    assert response.get_json()["error"]["code"] == "USER_NOT_FOUND"


def test_invite_already_member_returns_409(
    client, make_user, make_board, make_board_member
):
    owner = make_user()
    other = make_user()
    board = make_board(owner)
    make_board_member(board, other, role="member")

    response = client.post(
        f"/api/boards/{board.id}/members",
        json={"email": other.email},
        headers=_auth(owner),
    )

    assert response.status_code == 409


def test_invite_by_plain_member_returns_404(
    client, make_user, make_board, make_board_member
):
    owner = make_user()
    other = make_user()
    board = make_board(owner)
    make_board_member(board, other, role="member")
    stranger = make_user()
    make_board_member(board, stranger, role="member")

    response = client.post(
        f"/api/boards/{board.id}/members",
        json={"email": other.email},
        headers=_auth(other),
    )

    assert response.status_code == 404


def test_list_members_returns_all(
    client, make_user, make_board, make_board_member
):
    owner = make_user()
    other = make_user()
    board = make_board(owner)
    make_board_member(board, other, role="member")

    response = client.get(f"/api/boards/{board.id}/members", headers=_auth(owner))

    assert response.status_code == 200
    data = response.get_json()["data"]
    roles = {row["role"] for row in data}
    assert roles == {"owner", "member"}
    assert len(data) == 2


def test_list_members_non_member_returns_404(
    client, make_user, make_board, make_board_member
):
    owner = make_user()
    board = make_board(owner)
    stranger = make_user()

    response = client.get(
        f"/api/boards/{board.id}/members", headers=_auth(stranger)
    )

    assert response.status_code == 404
    assert response.get_json()["error"]["code"] == "BOARD_NOT_FOUND"


def test_remove_member_returns_204(
    client, make_user, make_board, make_board_member
):
    owner = make_user()
    other = make_user()
    board = make_board(owner)
    member_row = make_board_member(board, other, role="member")

    response = client.delete(
        f"/api/boards/{board.id}/members/{other.id}", headers=_auth(owner)
    )

    assert response.status_code == 204


def test_remove_owner_row_returns_409(
    client, make_user, make_board
):
    owner = make_user()
    board = make_board(owner)

    response = client.delete(
        f"/api/boards/{board.id}/members/{owner.id}", headers=_auth(owner)
    )

    assert response.status_code == 409


def test_remove_unknown_member_returns_404(
    client, make_user, make_board, make_board_member
):
    owner = make_user()
    board = make_board(owner)
    stranger = make_user()

    response = client.delete(
        f"/api/boards/{board.id}/members/{stranger.id}", headers=_auth(owner)
    )

    assert response.status_code == 404


def test_set_card_assignees_by_owner(
    client, make_user, make_board, make_column, make_card, make_board_member
):
    owner = make_user()
    other = make_user()
    board = make_board(owner)
    col = make_column(board)
    card = make_card(col, owner)
    make_board_member(board, other, role="member")

    response = client.patch(
        f"/api/v1/cards/{card.id}/assignees",
        json={"user_ids": [str(other.id)]},
        headers=_auth(owner),
    )

    assert response.status_code == 200


def test_set_card_assignees_rejects_non_member(
    client, make_user, make_board, make_column, make_card, make_board_member
):
    owner = make_user()
    stranger = make_user()
    board = make_board(owner)
    col = make_column(board)
    card = make_card(col, owner)

    response = client.patch(
        f"/api/v1/cards/{card.id}/assignees",
        json={"user_ids": [str(stranger.id)]},
        headers=_auth(owner),
    )

    assert response.status_code == 404


def test_set_card_assignees_by_plain_member_returns_404(
    client, make_user, make_board, make_column, make_card, make_board_member
):
    owner = make_user()
    other = make_user()
    board = make_board(owner)
    col = make_column(board)
    card = make_card(col, owner)
    make_board_member(board, other, role="member")

    response = client.patch(
        f"/api/v1/cards/{card.id}/assignees",
        json={"user_ids": []},
        headers=_auth(other),
    )

    assert response.status_code == 404
