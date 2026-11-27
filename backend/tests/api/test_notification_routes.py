"""API tests for comment-created notifications and the notifications routes."""

import uuid

from sqlalchemy import func, select

from app.models.notification import Notification
from tests.conftest import make_jwt


def _auth(user) -> dict:
    return {"Authorization": f"Bearer {make_jwt(user.id)}"}


def _card_for(user, make_board, make_column, make_card, title="Card title"):
    return make_card(make_column(make_board(user)), user, title=title)


def test_comment_by_sole_owner_creates_no_notification(
    client, db_session, make_user, make_board, make_column, make_card
):
    """With only one member, the author is excluded from their own event,
    so zero notification rows are created."""
    owner = make_user()
    card = _card_for(owner, make_board, make_column, make_card, title="Ship it")

    response = client.post(
        f"/api/cards/{card.id}/comments", json={"body": "Looks good"}, headers=_auth(owner)
    )

    assert response.status_code == 201
    assert db_session.execute(select(func.count(Notification.id))).scalar() == 0


def test_comment_by_member_notifies_the_owner(
    client, db_session, make_user, make_board, make_column, make_card,
    make_board_member
):
    """When a board has two members, the author's comment reaches the other
    member but not the author."""
    owner = make_user()
    member = make_user()
    board = make_board(owner)
    col = make_column(board)
    card = make_card(col, owner, title="Ship it")
    make_board_member(board, member, role="member")

    response = client.post(
        f"/api/cards/{card.id}/comments",
        json={"body": "Looks good"},
        headers=_auth(member),
    )

    assert response.status_code == 201
    rows = db_session.execute(select(Notification)).scalars().all()
    assert len(rows) == 1
    assert rows[0].user_id == owner.id
    assert rows[0].title == "New comment on Ship it"
    assert rows[0].body == "Looks good"
    assert rows[0].is_read is False


def test_mark_read_updates_flag_and_unread_count(
    client, db_session, make_user, make_board, make_column, make_card,
    make_board_member
):
    owner = make_user()
    member = make_user()
    board = make_board(owner)
    col = make_column(board)
    card = make_card(col, owner, title="Task")
    make_board_member(board, member, role="member")

    # The member's comment creates one notification for the owner.
    client.post(
        f"/api/cards/{card.id}/comments",
        json={"body": "one"},
        headers=_auth(member),
    )

    headers_owner = _auth(owner)
    note_id = client.get("/api/notifications", headers=headers_owner).get_json()["data"][0]["id"]

    response = client.patch(f"/api/notifications/{note_id}/read", headers=headers_owner)

    assert response.status_code == 200
    assert response.get_json()["data"]["is_read"] is True
    meta = client.get("/api/notifications", headers=headers_owner).get_json()["meta"]
    assert meta["unread_count"] == 0
    assert meta["total"] == 1


def test_other_user_cannot_mark_read_or_see_notifications(
    client, db_session, make_user, make_board, make_column, make_card,
    make_board_member
):
    owner = make_user()
    member = make_user()
    stranger = make_user()
    board = make_board(owner)
    col = make_column(board)
    card = make_card(col, owner, title="Task")
    make_board_member(board, member, role="member")

    # The member's comment notifies the owner only.
    client.post(
        f"/api/cards/{card.id}/comments", json={"body": "private"}, headers=_auth(member)
    )
    note = db_session.execute(select(Notification)).scalar_one()
    assert note.user_id == owner.id

    mark = client.patch(f"/api/notifications/{note.id}/read", headers=_auth(stranger))
    listing = client.get("/api/notifications", headers=_auth(stranger))

    assert mark.status_code == 404
    assert mark.get_json()["error"]["code"] == "NOTIFICATION_NOT_FOUND"
    assert listing.get_json()["data"] == []
    assert listing.get_json()["meta"]["unread_count"] == 0
    db_session.expire_all()
    assert db_session.get(Notification, note.id).is_read is False


def test_notifications_require_token(client):
    assert client.get("/api/notifications").status_code == 401
    assert client.patch(f"/api/notifications/{uuid.uuid4()}/read").status_code == 401


def test_failed_comment_creates_no_notification(
    client, db_session, make_user, make_board, make_column, make_card
):
    owner = make_user()
    card = _card_for(owner, make_board, make_column, make_card)

    blank = client.post(
        f"/api/cards/{card.id}/comments", json={"body": "   "}, headers=_auth(owner)
    )
    missing = client.post(f"/api/cards/{card.id}/comments", json={}, headers=_auth(owner))

    assert blank.status_code == 400
    assert missing.status_code == 400
    assert db_session.execute(select(func.count(Notification.id))).scalar() == 0


def test_comment_on_other_users_card_returns_404(
    client, db_session, make_user, make_board, make_column, make_card
):
    """A non-member of the card's board cannot comment on it (404).

    No notification row is created because the comment was never saved.
    """
    owner = make_user()
    intruder = make_user()
    card = _card_for(owner, make_board, make_column, make_card)

    response = client.post(
        f"/api/cards/{card.id}/comments", json={"body": "hi"}, headers=_auth(intruder)
    )

    assert response.status_code == 404
    assert db_session.execute(select(func.count(Notification.id))).scalar() == 0
