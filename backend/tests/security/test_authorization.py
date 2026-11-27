"""Authentication and cross-user checks for the label routes (27 to 31)."""
import uuid

import pytest

from tests.conftest import make_jwt


def _auth(user) -> dict:
    return {"Authorization": f"Bearer {make_jwt(user.id)}"}


@pytest.fixture()
def world(make_user, make_board, make_column, make_card, make_label):
    import types

    owner, intruder = make_user(), make_user()
    board = make_board(owner)
    card = make_card(make_column(board), owner)
    label = make_label(board, name="secret")
    return types.SimpleNamespace(owner=owner, intruder=intruder, board=board, card=card, label=label)


def _routes(w):
    return [
        ("get", f"/api/boards/{w.board.id}/labels", None),
        ("post", f"/api/boards/{w.board.id}/labels", {"name": "n", "color": "red"}),
        ("patch", f"/api/labels/{w.label.id}", {"name": "renamed"}),
        ("delete", f"/api/labels/{w.label.id}", None),
        ("put", f"/api/v1/cards/{w.card.id}/labels", {"label_ids": [str(w.label.id)]}),
    ]


@pytest.mark.parametrize("index", range(5))
def test_label_routes_require_a_token(client, world, index):
    method, url, body = _routes(world)[index]

    response = getattr(client, method)(url, json=body)

    assert response.status_code == 401


@pytest.mark.parametrize("index", range(5))
def test_label_routes_reject_an_invalid_token(client, world, index):
    method, url, body = _routes(world)[index]

    response = getattr(client, method)(url, json=body, headers={"Authorization": "Bearer nope"})

    assert response.status_code == 401


@pytest.mark.parametrize("index", range(5))
def test_label_routes_return_404_for_another_users_resources(client, world, index, db_session):
    method, url, body = _routes(world)[index]

    response = getattr(client, method)(url, json=body, headers=_auth(world.intruder))

    assert response.status_code == 404
    db_session.expire_all()
    assert world.label.name == "secret"
    assert world.card.labels == []


@pytest.mark.parametrize(
    "template",
    [
        "/api/boards/{}/labels",
        "/api/labels/{}",
        "/api/v1/cards/{}/labels",
    ],
)
@pytest.mark.parametrize("method", ["get", "post", "patch", "delete", "put"])
def test_malformed_path_uuid_returns_404(client, world, template, method):
    response = getattr(client, method)(template.format("not-a-uuid"), json={}, headers=_auth(world.owner))

    assert response.status_code in (404, 405)
    if response.status_code == 404:
        assert response.get_json()["error"]["code"] != "INTERNAL_ERROR"


def test_unknown_uuid_paths_return_404(client, world):
    missing = uuid.uuid4()
    headers = _auth(world.owner)

    assert client.get(f"/api/boards/{missing}/labels", headers=headers).status_code == 404
    assert client.patch(f"/api/labels/{missing}", json={"name": "x"}, headers=headers).status_code == 404
    assert client.put(
        f"/api/v1/cards/{missing}/labels", json={"label_ids": []}, headers=headers
    ).status_code == 404


def test_label_responses_never_expose_other_users_data(client, world):
    response = client.get(f"/api/boards/{world.board.id}/labels", headers=_auth(world.owner))

    body = response.get_data(as_text=True)
    assert str(world.intruder.id) not in body
    assert "password" not in body
