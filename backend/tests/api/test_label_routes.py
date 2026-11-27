"""API tests for the board label routes (27 to 30)."""
import uuid

import pytest

from app.models.label import Label
from tests.conftest import make_jwt


def _auth(user) -> dict:
    return {"Authorization": f"Bearer {make_jwt(user.id)}"}


LABEL_KEYS = {"id", "board_id", "name", "color", "created_at", "updated_at"}


@pytest.fixture()
def world(make_user, make_board):
    import types

    owner = make_user()
    other = make_user()
    board = make_board(owner)
    return types.SimpleNamespace(owner=owner, other=other, board=board)


def _url(board):
    return f"/api/boards/{board.id}/labels"


def test_list_labels_sorted_case_insensitively(client, world, make_label):
    make_label(world.board, name="beta")
    make_label(world.board, name="Alpha")
    make_label(world.board, name="Charlie")

    response = client.get(_url(world.board), headers=_auth(world.owner))

    assert response.status_code == 200
    assert [l["name"] for l in response.get_json()["data"]] == ["Alpha", "beta", "Charlie"]
    assert set(response.get_json()["data"][0]) == LABEL_KEYS


def test_list_empty_board_returns_empty_list(client, world):
    response = client.get(_url(world.board), headers=_auth(world.owner))
    assert response.status_code == 200
    assert response.get_json()["data"] == []


def test_create_label_returns_201_and_trims_name(client, world, db_session):
    response = client.post(
        _url(world.board), json={"name": "  Bug  ", "color": "red"}, headers=_auth(world.owner)
    )

    assert response.status_code == 201
    data = response.get_json()["data"]
    assert set(data) == LABEL_KEYS
    assert (data["name"], data["color"], data["board_id"]) == ("Bug", "red", str(world.board.id))
    assert db_session.get(Label, uuid.UUID(data["id"])) is not None


@pytest.mark.parametrize(
    "body, field",
    [
        ({"color": "red"}, "name"),
        ({"name": "x"}, "color"),
        ({"name": "   ", "color": "red"}, "name"),
        ({"name": "", "color": "red"}, "name"),
        ({"name": "a" * 51, "color": "red"}, "name"),
        ({"name": "ok", "color": "pink"}, "color"),
        ({"name": 5, "color": "red"}, "name"),
        ({"name": "ok", "color": "red", "extra": 1}, "extra"),
    ],
)
def test_create_label_validation_errors_return_400(client, world, body, field):
    response = client.post(_url(world.board), json=body, headers=_auth(world.owner))

    assert response.status_code == 400
    error = response.get_json()["error"]
    assert error["code"] == "VALIDATION_ERROR"
    assert field in error["details"]


def test_create_label_accepts_name_of_exactly_50_chars(client, world):
    response = client.post(
        _url(world.board), json={"name": "a" * 50, "color": "sky"}, headers=_auth(world.owner)
    )
    assert response.status_code == 201


def test_create_label_duplicate_name_is_case_insensitive_409(client, world, make_label):
    make_label(world.board, name="Urgent")

    response = client.post(
        _url(world.board), json={"name": "URGENT", "color": "red"}, headers=_auth(world.owner)
    )

    assert response.status_code == 409
    assert response.get_json()["error"]["code"] == "RESOURCE_CONFLICT"
    assert response.get_json()["error"]["message"] == "A label with that name already exists."


def test_same_name_on_another_board_is_allowed(client, world, make_label, make_board):
    make_label(world.board, name="Urgent")
    other_board = make_board(world.owner)

    response = client.post(
        _url(other_board), json={"name": "Urgent", "color": "red"}, headers=_auth(world.owner)
    )

    assert response.status_code == 201


def test_create_label_on_other_users_board_returns_404(client, world, db_session):
    response = client.post(
        _url(world.board), json={"name": "X", "color": "red"}, headers=_auth(world.other)
    )

    assert response.status_code == 404
    assert response.get_json()["error"]["code"] == "BOARD_NOT_FOUND"
    assert db_session.query(Label).count() == 0


def test_update_label_name_and_color(client, world, make_label):
    label = make_label(world.board, name="Old", color="blue")

    response = client.patch(
        f"/api/labels/{label.id}", json={"name": "New", "color": "green"}, headers=_auth(world.owner)
    )

    assert response.status_code == 200
    data = response.get_json()["data"]
    assert (data["name"], data["color"]) == ("New", "green")


def test_update_label_case_only_rename_is_allowed(client, world, make_label):
    label = make_label(world.board, name="bug")

    response = client.patch(
        f"/api/labels/{label.id}", json={"name": "Bug"}, headers=_auth(world.owner)
    )

    assert response.status_code == 200
    assert response.get_json()["data"]["name"] == "Bug"


def test_update_label_to_existing_name_returns_409(client, world, make_label):
    make_label(world.board, name="Taken")
    label = make_label(world.board, name="Free")

    response = client.patch(
        f"/api/labels/{label.id}", json={"name": "taken"}, headers=_auth(world.owner)
    )

    assert response.status_code == 409


def test_update_label_recolour_only(client, world, make_label):
    label = make_label(world.board, name="Same", color="blue")

    response = client.patch(
        f"/api/labels/{label.id}", json={"color": "purple"}, headers=_auth(world.owner)
    )

    assert response.status_code == 200
    assert response.get_json()["data"]["name"] == "Same"


@pytest.mark.parametrize(
    "body", [{}, {"color": "nope"}, {"name": " "}, {"name": "ok", "bogus": 1}]
)
def test_update_label_invalid_body_returns_400(client, world, make_label, body):
    label = make_label(world.board, name="Keep", color="blue")

    response = client.patch(f"/api/labels/{label.id}", json=body, headers=_auth(world.owner))

    assert response.status_code == 400
    assert response.get_json()["error"]["code"] == "VALIDATION_ERROR"
    assert (label.name, label.color) == ("Keep", "blue")


def test_update_other_users_label_returns_404_and_changes_nothing(client, world, make_label):
    label = make_label(world.board, name="Mine", color="blue")

    response = client.patch(
        f"/api/labels/{label.id}", json={"name": "Hacked"}, headers=_auth(world.other)
    )

    assert response.status_code == 404
    assert response.get_json()["error"]["code"] == "LABEL_NOT_FOUND"
    assert label.name == "Mine"


def test_delete_label_returns_204_and_removes_row(client, world, make_label, db_session):
    label = make_label(world.board)
    label_id = label.id

    response = client.delete(f"/api/labels/{label_id}", headers=_auth(world.owner))

    assert response.status_code == 204
    db_session.expire_all()
    assert db_session.get(Label, label_id) is None


def test_delete_other_users_label_returns_404_and_keeps_it(client, world, make_label, db_session):
    label = make_label(world.board)

    response = client.delete(f"/api/labels/{label.id}", headers=_auth(world.other))

    assert response.status_code == 404
    assert db_session.get(Label, label.id) is not None


def test_delete_unknown_label_returns_404(client, world):
    response = client.delete(f"/api/labels/{uuid.uuid4()}", headers=_auth(world.owner))
    assert response.status_code == 404
    assert response.get_json()["error"]["code"] == "LABEL_NOT_FOUND"
