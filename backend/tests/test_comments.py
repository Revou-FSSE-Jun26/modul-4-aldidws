"""
API tests for POST /api/cards/<card_id>/comments.

Covers four scenarios:
1. 201 + comment body in data   — authenticated user posts to their own card
2. 400                          — authenticated user sends an empty body {}
3. 401                          — no Authorization header
4. 403                          — authenticated user posts to another user's card
"""

import uuid

from tests.conftest import make_jwt


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _auth_headers(user_id) -> dict:
    return {"Authorization": f"Bearer {make_jwt(user_id)}"}


def _post_comment(client, card_id, body_text, headers):
    return client.post(
        f"/api/cards/{card_id}/comments",
        json={"body": body_text},
        headers=headers,
    )


# ---------------------------------------------------------------------------
# Test 1 — successful comment creation returns 201 and the comment text
# ---------------------------------------------------------------------------

def test_create_comment_returns_201(
    client, db_session, make_user, make_board, make_column, make_card
):
    """A valid authenticated POST to /api/cards/<id>/comments returns 201 and
    the submitted comment body inside ``data``."""
    user = make_user()
    board = make_board(user)
    col = make_column(board)
    card = make_card(col, user)

    response = _post_comment(
        client,
        card.id,
        "This is my first comment.",
        _auth_headers(user.id),
    )

    assert response.status_code == 201

    payload = response.get_json()
    assert payload is not None
    assert "data" in payload
    assert payload["data"]["body"] == "This is my first comment."


# ---------------------------------------------------------------------------
# Test 2 — missing body field returns 400
# ---------------------------------------------------------------------------

def test_missing_body_returns_400(
    client, db_session, make_user, make_board, make_column, make_card
):
    """Sending an empty JSON object {} (no ``body`` field) returns 400
    with an ``error`` envelope."""
    user = make_user()
    board = make_board(user)
    col = make_column(board)
    card = make_card(col, user)

    response = client.post(
        f"/api/cards/{card.id}/comments",
        json={},
        headers=_auth_headers(user.id),
    )

    assert response.status_code == 400

    payload = response.get_json()
    assert payload is not None
    assert "error" in payload


# ---------------------------------------------------------------------------
# Test 3 — no Authorization header returns 401
# ---------------------------------------------------------------------------

def test_unauthenticated_returns_401(
    client, db_session, make_user, make_board, make_column, make_card
):
    """A request with no Authorization header returns 401."""
    user = make_user()
    board = make_board(user)
    col = make_column(board)
    card = make_card(col, user)

    response = client.post(
        f"/api/cards/{card.id}/comments",
        json={"body": "Should not be created."},
        # No Authorization header
    )

    assert response.status_code == 401

    payload = response.get_json()
    assert payload is not None
    assert "error" in payload


# ---------------------------------------------------------------------------
# Test 4 — posting to another user's card returns 403 / 404 (non-disclosing)
# ---------------------------------------------------------------------------

def test_forbidden_returns_403_or_404_for_other_users_card(
    client, db_session, make_user, make_board, make_column, make_card
):
    """A user with a valid token cannot post a comment to a card owned by
    another user.  The service raises CardNotFoundException (non-disclosing
    404) because the ownership join returns nothing for the calling user —
    the endpoint never reveals whether the card exists for a different owner.
    """
    owner = make_user()
    intruder = make_user()

    board = make_board(owner)
    col = make_column(board)
    card = make_card(col, owner)

    # intruder has a valid JWT but the card belongs to owner's board
    response = _post_comment(
        client,
        card.id,
        "I should not be able to comment here.",
        _auth_headers(intruder.id),
    )

    # The service uses a non-disclosing 404 (CardNotFoundException) for
    # cross-user card access — consistent with the ownership policy applied
    # across all protected resources in this application.
    # Tightened from ``in (403, 404)``: the implemented behaviour is exactly
    # 404 CARD_NOT_FOUND, so the test now pins it down.
    assert response.status_code == 404

    payload = response.get_json()
    assert payload is not None
    assert payload["error"]["code"] == "CARD_NOT_FOUND"


# ---------------------------------------------------------------------------
# Edit / delete rules and author_name
# ---------------------------------------------------------------------------

def _seed_comment(client, make_user, make_board, make_column, make_card, name=None):
    user = make_user()
    if name is not None:
        user.name = name
    card = make_card(make_column(make_board(user)), user)
    response = _post_comment(client, card.id, "original", _auth_headers(user.id))
    assert response.status_code == 201
    return user, card, response.get_json()["data"]


def test_create_comment_includes_author_name_from_name(
    client, make_user, make_board, make_column, make_card
):
    _, _, comment = _seed_comment(
        client, make_user, make_board, make_column, make_card, name="Alice Doe"
    )

    assert comment["author_name"] == "Alice Doe"


def test_author_name_falls_back_to_email_local_part(
    client, make_user, make_board, make_column, make_card
):
    user = make_user(email="bob.smith@example.com")
    card = make_card(make_column(make_board(user)), user)

    created = _post_comment(client, card.id, "hi", _auth_headers(user.id))
    listed = client.get(f"/api/cards/{card.id}/comments", headers=_auth_headers(user.id))

    assert created.get_json()["data"]["author_name"] == "bob.smith"
    assert listed.get_json()["data"][0]["author_name"] == "bob.smith"


def test_author_can_edit_comment(client, make_user, make_board, make_column, make_card):
    user, _, comment = _seed_comment(client, make_user, make_board, make_column, make_card)

    response = client.patch(
        f"/api/comments/{comment['id']}",
        json={"body": "edited"},
        headers=_auth_headers(user.id),
    )

    assert response.status_code == 200
    data = response.get_json()["data"]
    assert data["body"] == "edited"
    assert "author_name" in data


def test_author_can_delete_comment(client, make_user, make_board, make_column, make_card):
    user, card, comment = _seed_comment(client, make_user, make_board, make_column, make_card)

    response = client.delete(
        f"/api/comments/{comment['id']}", headers=_auth_headers(user.id)
    )

    assert response.status_code == 204
    listed = client.get(f"/api/cards/{card.id}/comments", headers=_auth_headers(user.id))
    assert listed.get_json()["data"] == []


def test_edit_other_users_comment_returns_exact_403(
    client, make_user, make_board, make_column, make_card
):
    _, _, comment = _seed_comment(client, make_user, make_board, make_column, make_card)
    intruder = make_user()

    response = client.patch(
        f"/api/comments/{comment['id']}",
        json={"body": "hijack"},
        headers=_auth_headers(intruder.id),
    )

    assert response.status_code == 403
    assert response.get_json()["error"]["code"] == "COMMENT_ACCESS_DENIED"


def test_delete_other_users_comment_returns_exact_403(
    client, make_user, make_board, make_column, make_card
):
    _, _, comment = _seed_comment(client, make_user, make_board, make_column, make_card)
    intruder = make_user()

    response = client.delete(
        f"/api/comments/{comment['id']}", headers=_auth_headers(intruder.id)
    )

    assert response.status_code == 403
    assert response.get_json()["error"]["code"] == "COMMENT_ACCESS_DENIED"


def test_edit_comment_with_blank_body_returns_400(
    client, make_user, make_board, make_column, make_card
):
    user, _, comment = _seed_comment(client, make_user, make_board, make_column, make_card)

    response = client.patch(
        f"/api/comments/{comment['id']}",
        json={"body": "   "},
        headers=_auth_headers(user.id),
    )

    assert response.status_code == 400
    assert response.get_json()["error"]["code"] == "VALIDATION_ERROR"


def test_create_comment_with_blank_body_returns_400(
    client, make_user, make_board, make_column, make_card
):
    user = make_user()
    card = make_card(make_column(make_board(user)), user)

    response = _post_comment(client, card.id, "   ", _auth_headers(user.id))

    assert response.status_code == 400


def test_edit_and_delete_comment_without_token_return_401(
    client, make_user, make_board, make_column, make_card
):
    _, _, comment = _seed_comment(client, make_user, make_board, make_column, make_card)

    assert client.patch(f"/api/comments/{comment['id']}", json={"body": "x"}).status_code == 401
    assert client.delete(f"/api/comments/{comment['id']}").status_code == 401


def test_edit_unknown_comment_returns_404(client, make_user):
    user = make_user()

    response = client.patch(
        f"/api/comments/{uuid.uuid4()}",
        json={"body": "x"},
        headers=_auth_headers(user.id),
    )

    assert response.status_code == 404
    assert response.get_json()["error"]["code"] == "COMMENT_NOT_FOUND"
