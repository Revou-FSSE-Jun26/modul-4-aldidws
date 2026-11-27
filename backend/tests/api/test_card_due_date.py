"""API tests for the optional ``due_date`` field of cards (create, patch, reads)."""
from datetime import datetime, timezone

import pytest

from app.models.card import Card
from tests.conftest import make_jwt


def _auth(user) -> dict:
    return {"Authorization": f"Bearer {make_jwt(user.id)}"}


@pytest.fixture()
def setup(make_user, make_board, make_column, make_card):
    import types

    user = make_user()
    board = make_board(user)
    col = make_column(board)
    card = make_card(col, user, title="With date")
    return types.SimpleNamespace(user=user, board=board, col=col, card=card)


def _create(client, setup, body):
    return client.post(
        f"/api/v1/columns/{setup.col.id}/cards", json=body, headers=_auth(setup.user)
    )


def _patch(client, setup, body, user=None):
    return client.patch(
        f"/api/v1/cards/{setup.card.id}", json=body, headers=_auth(user or setup.user)
    )


# --- create -----------------------------------------------------------------


def test_create_with_due_date_returns_201_in_utc_z_format(client, setup):
    response = _create(client, setup, {"title": "T", "due_date": "2026-12-01T17:00:00Z"})
    assert response.status_code == 201
    assert response.get_json()["data"]["due_date"] == "2026-12-01T17:00:00Z"


def test_create_without_due_date_returns_null(client, setup):
    response = _create(client, setup, {"title": "T"})
    assert response.status_code == 201
    assert response.get_json()["data"]["due_date"] is None


def test_create_with_null_due_date_returns_null(client, setup):
    response = _create(client, setup, {"title": "T", "due_date": None})
    assert response.status_code == 201
    assert response.get_json()["data"]["due_date"] is None


def test_create_converts_offset_to_utc_and_drops_fractions(client, setup):
    response = _create(
        client, setup, {"title": "T", "due_date": "2026-12-01T17:00:00.987+07:00"}
    )
    assert response.status_code == 201
    assert response.get_json()["data"]["due_date"] == "2026-12-01T10:00:00Z"


def test_create_with_invalid_due_date_returns_400(client, setup):
    response = _create(client, setup, {"title": "T", "due_date": "2026-12-01x"})
    assert response.status_code == 400
    assert response.get_json()["error"]["code"] == "VALIDATION_ERROR"
    assert "due_date" in response.get_json()["error"]["details"]


# --- patch ------------------------------------------------------------------


def test_patch_sets_due_date_and_persists(client, db_session, setup):
    response = _patch(client, setup, {"due_date": "2027-01-15T08:30:00Z"})
    assert response.status_code == 200
    assert response.get_json()["data"]["due_date"] == "2027-01-15T08:30:00Z"
    db_session.expire_all()
    stored = db_session.get(Card, setup.card.id)
    assert stored.due_date is not None
    # PostgreSQL returns the instant in the session time zone; compare instants.
    assert stored.due_date == datetime(2027, 1, 15, 8, 30, tzinfo=timezone.utc)


def test_patch_without_due_date_leaves_it_unchanged(client, setup):
    _patch(client, setup, {"due_date": "2027-01-15T08:30:00Z"})
    response = _patch(client, setup, {"title": "Renamed"})
    assert response.status_code == 200
    data = response.get_json()["data"]
    assert data["title"] == "Renamed"
    assert data["due_date"] == "2027-01-15T08:30:00Z"


def test_patch_null_clears_due_date(client, setup):
    _patch(client, setup, {"due_date": "2027-01-15T08:30:00Z"})
    response = _patch(client, setup, {"due_date": None})
    assert response.status_code == 200
    assert response.get_json()["data"]["due_date"] is None


def test_patch_converts_offset_to_utc(client, setup):
    response = _patch(client, setup, {"due_date": "2027-01-15T08:30:00+07:00"})
    assert response.get_json()["data"]["due_date"] == "2027-01-15T01:30:00Z"


@pytest.mark.parametrize(
    "value",
    [
        "not-a-date",
        "2027-01-15",  # date only: naive, rejected
        "2027-01-15T08:30:00",  # naive
        "1999-12-31T23:59:59Z",
        "2101-01-01T00:00:00Z",
        "9999-12-31T23:59:59-05:00",  # would overflow when converted to UTC
        "0001-01-01T00:00:00+05:00",  # would overflow when converted to UTC
        12345,
        True,
    ],
)
def test_patch_invalid_due_date_returns_400_not_500(client, setup, value):
    response = _patch(client, setup, {"due_date": value})
    assert response.status_code == 400
    body = response.get_json()["error"]
    assert body["code"] == "VALIDATION_ERROR"
    assert "due_date" in body["details"]


def test_patch_boundary_years_are_accepted(client, setup):
    low = _patch(client, setup, {"due_date": "2000-01-01T00:00:00Z"})
    high = _patch(client, setup, {"due_date": "2100-12-31T23:59:59Z"})
    assert low.status_code == 200
    assert high.status_code == 200


def test_invalid_due_date_leaves_stored_value_unchanged(client, setup):
    _patch(client, setup, {"due_date": "2027-01-15T08:30:00Z"})
    bad = _patch(client, setup, {"due_date": "1999-01-01T00:00:00Z"})
    assert bad.status_code == 400
    ok = _patch(client, setup, {"title": "x"})
    assert ok.get_json()["data"]["due_date"] == "2027-01-15T08:30:00Z"


def test_patch_unknown_field_still_rejected(client, setup):
    response = _patch(client, setup, {"due_date": None, "dueDate": "2027-01-15T08:30:00Z"})
    assert response.status_code == 400
    assert response.get_json()["error"]["details"]["dueDate"] == ["Unknown field."]


# --- authentication and ownership -------------------------------------------


def test_patch_due_date_without_token_returns_401(client, setup):
    response = client.patch(
        f"/api/v1/cards/{setup.card.id}", json={"due_date": "2027-01-15T08:30:00Z"}
    )
    assert response.status_code == 401


def test_other_users_card_returns_404_and_is_unchanged(client, make_user, setup):
    _patch(client, setup, {"due_date": "2027-01-15T08:30:00Z"})
    intruder = make_user()
    response = _patch(client, setup, {"due_date": None}, user=intruder)
    assert response.status_code == 404
    owner_view = client.get(f"/api/boards/{setup.board.id}", headers=_auth(setup.user))
    cards = owner_view.get_json()["data"]["columns"][0]["cards"]
    assert cards[0]["due_date"] == "2027-01-15T08:30:00Z"


def test_create_in_other_users_column_with_due_date_returns_404(client, make_user, setup):
    response = client.post(
        f"/api/v1/columns/{setup.col.id}/cards",
        json={"title": "T", "due_date": "2027-01-15T08:30:00Z"},
        headers=_auth(make_user()),
    )
    assert response.status_code == 404


# --- other responses carry the field ----------------------------------------


def test_board_read_and_card_list_contain_due_date(client, setup):
    _patch(client, setup, {"due_date": "2027-01-15T08:30:00Z"})
    board = client.get(f"/api/boards/{setup.board.id}", headers=_auth(setup.user))
    assert board.get_json()["data"]["columns"][0]["cards"][0]["due_date"] == "2027-01-15T08:30:00Z"
    listing = client.get("/api/v1/cards?mine=true", headers=_auth(setup.user))
    assert listing.get_json()["data"][0]["due_date"] == "2027-01-15T08:30:00Z"


def test_move_keeps_due_date(client, make_column, setup):
    _patch(client, setup, {"due_date": "2027-01-15T08:30:00Z"})
    other = make_column(setup.board, position=1)
    response = client.patch(
        f"/api/v1/cards/{setup.card.id}/position",
        json={"column_id": str(other.id), "order": 0},
        headers=_auth(setup.user),
    )
    assert response.status_code == 200
    assert response.get_json()["data"]["due_date"] == "2027-01-15T08:30:00Z"
