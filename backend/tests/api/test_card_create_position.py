"""API tests for the optional ``position`` field when creating a card."""
from datetime import datetime, timezone

import pytest

from app.extensions import db
from app.models.card import Card
from tests.conftest import make_jwt


def _auth(user) -> dict:
    return {"Authorization": f"Bearer {make_jwt(user.id)}"}


@pytest.fixture()
def setup(make_user, make_board, make_column):
    import types

    user = make_user()
    board = make_board(user)
    col = make_column(board)
    return types.SimpleNamespace(user=user, board=board, col=col)


def _create(client, col, user, body):
    return client.post(
        f"/api/v1/columns/{col.id}/cards", json=body, headers=_auth(user)
    )


def _titles_in_order(col):
    cards = db.session.execute(
        db.select(Card)
        .where(Card.column_id == col.id)
        .where(Card.deleted_at.is_(None))
        .order_by(Card.order.asc())
    ).scalars().all()
    return [c.title for c in cards]


def test_top_places_new_card_first_even_when_first_order_is_zero(
    client, setup, make_card
):
    make_card(setup.col, setup.user, title="First", order=0.0)
    make_card(setup.col, setup.user, title="Second", order=1.0)

    response = _create(client, setup.col, setup.user, {"title": "Top", "position": "top"})

    assert response.status_code == 201
    assert response.get_json()["data"]["order"] >= 0.0
    assert _titles_in_order(setup.col) == ["Top", "First", "Second"]


def test_top_uses_order_below_first_card_when_there_is_room(client, setup, make_card):
    make_card(setup.col, setup.user, title="First", order=3.0)

    response = _create(client, setup.col, setup.user, {"title": "Top", "position": "top"})

    assert response.status_code == 201
    assert response.get_json()["data"]["order"] == 2.0


def test_top_on_empty_column_uses_default_order(client, setup):
    response = _create(client, setup.col, setup.user, {"title": "Only", "position": "top"})

    assert response.status_code == 201
    assert response.get_json()["data"]["order"] == 0.0


def test_top_ignores_soft_deleted_cards(client, setup, make_card):
    make_card(setup.col, setup.user, title="Live", order=5.0)
    deleted = make_card(setup.col, setup.user, title="Gone", order=0.0)
    deleted.deleted_at = datetime.now(timezone.utc)
    db.session.flush()

    response = _create(client, setup.col, setup.user, {"title": "Top", "position": "top"})

    assert response.status_code == 201
    assert response.get_json()["data"]["order"] == 4.0
    assert deleted.order == 0.0


def test_repeated_top_creations_stack_newest_first(client, setup, make_card):
    make_card(setup.col, setup.user, title="Old", order=0.0)

    for title in ("A", "B", "C"):
        response = _create(client, setup.col, setup.user, {"title": title, "position": "top"})
        assert response.status_code == 201

    assert _titles_in_order(setup.col) == ["C", "B", "A", "Old"]


@pytest.mark.parametrize("body", [{"title": "T"}, {"title": "T", "position": "bottom"}])
def test_omitted_or_bottom_position_appends(client, setup, make_card, body):
    make_card(setup.col, setup.user, title="First", order=0.0)
    make_card(setup.col, setup.user, title="Second", order=3.0)

    response = _create(client, setup.col, setup.user, body)

    assert response.status_code == 201
    assert response.get_json()["data"]["order"] == 4.0


@pytest.mark.parametrize("value", ["middle", "TOP", "", None, 1, True])
def test_invalid_position_returns_400_with_field_details(client, setup, value):
    response = _create(client, setup.col, setup.user, {"title": "T", "position": value})

    assert response.status_code == 400
    error = response.get_json()["error"]
    assert error["code"] == "VALIDATION_ERROR"
    assert "position" in error["details"]


def test_other_users_column_returns_404_for_top_position(client, setup, make_user):
    other = make_user()

    response = _create(client, setup.col, other, {"title": "T", "position": "top"})

    assert response.status_code == 404


def test_missing_token_returns_401(client, setup):
    response = client.post(
        f"/api/v1/columns/{setup.col.id}/cards",
        json={"title": "T", "position": "top"},
    )

    assert response.status_code == 401
