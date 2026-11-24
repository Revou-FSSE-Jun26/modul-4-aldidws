"""API tests for comment-created notifications and the notifications routes."""

import uuid

from sqlalchemy import func, select

from app.models.notification import Notification
from tests.conftest import make_jwt


def _auth(user) -> dict:
    return {"Authorization": f"Bearer {make_jwt(user.id)}"}


def _card_for(user, make_board, make_column, make_card, title="Card title"):
    return make_card(make_column(make_board(user)), user, title=title)


def test_comment_creates_one_notification_for_board_owner(
    client, db_session, make_user, make_board, make_column, make_card
):
    owner = make_user()
    card = _card_for(owner, make_board, make_column, make_card, title="Ship it")

    response = client.post(
        f"/api/cards/{card.id}/comments", json={"body": "Looks good"}, headers=_auth(owner)
    )

    assert response.status_code == 201
    rows = db_session.execute(select(Notification)).scalars().all()
    assert len(rows) == 1
    assert rows[0].user_id == owner.id
    assert rows[0].title == "New comment on Ship it"
    assert rows[0].body == "Looks good"
    assert rows[0].is_read is False


def test_list_includes_unread_count_in_meta(
    client, make_user, make_board, make_column, make_card
):
    owner = make_user()
    card = _card_for(owner, make_board, make_column, make_card)
    headers = _auth(owner)
    client.post(f"/api/cards/{card.id}/comments", json={"body": "one"}, headers=headers)
    client.post(f"/api/cards/{card.id}/comments", json={"body": "two"}, headers=headers)

    response = client.get("/api/notifications", headers=headers)

    assert response.status_code == 200
    body = response.get_json()
    assert len(body["data"]) == 2
    assert body["meta"] == {"page": 1, "per_page": 20, "total": 2, "unread_count": 2}


def test_mark_read_updates_flag_and_unread_count(
    client, make_user, make_board, make_column, make_card
):
    owner = make_user()
    card = _card_for(owner, make_board, make_column, make_card)
    headers = _auth(owner)
    client.post(f"/api/cards/{card.id}/comments", json={"body": "one"}, headers=headers)
    note_id = client.get("/api/notifications", headers=headers).get_json()["data"][0]["id"]

    response = client.patch(f"/api/notifications/{note_id}/read", headers=headers)

    assert response.status_code == 200
    assert response.get_json()["data"]["is_read"] is True
    meta = client.get("/api/notifications", headers=headers).get_json()["meta"]
    assert meta["unread_count"] == 0
    assert meta["total"] == 1


def test_other_user_cannot_mark_read_or_see_notifications(
    client, db_session, make_user, make_board, make_column, make_card
):
    owner = make_user()
    other = make_user()
    card = _card_for(owner, make_board, make_column, make_card)
    client.post(
        f"/api/cards/{card.id}/comments", json={"body": "private"}, headers=_auth(owner)
    )
    note = db_session.execute(select(Notification)).scalar_one()

    mark = client.patch(f"/api/notifications/{note.id}/read", headers=_auth(other))
    listing = client.get("/api/notifications", headers=_auth(other))

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


def test_comment_on_other_users_card_creates_no_notification(
    client, db_session, make_user, make_board, make_column, make_card
):
    owner = make_user()
    intruder = make_user()
    card = _card_for(owner, make_board, make_column, make_card)

    response = client.post(
        f"/api/cards/{card.id}/comments", json={"body": "hi"}, headers=_auth(intruder)
    )

    assert response.status_code == 404
    assert db_session.execute(select(func.count(Notification.id))).scalar() == 0
