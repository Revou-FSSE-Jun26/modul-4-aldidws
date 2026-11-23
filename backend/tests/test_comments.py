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
    assert response.status_code in (403, 404)

    payload = response.get_json()
    assert payload is not None
    assert "error" in payload
