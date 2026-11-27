"""API tests for PUT /api/v1/cards/{card_id}/labels (route 31)."""
import types
import uuid

import pytest

from tests.conftest import make_jwt


def _auth(user) -> dict:
    return {"Authorization": f"Bearer {make_jwt(user.id)}"}


@pytest.fixture()
def world(make_user, make_board, make_column, make_card, make_label):
    owner = make_user()
    other = make_user()
    board = make_board(owner)
    col = make_column(board)
    card = make_card(col, owner, title="Card")
    other_board = make_board(owner, name="Second board")
    return types.SimpleNamespace(
        owner=owner,
        other=other,
        board=board,
        col=col,
        card=card,
        a=make_label(board, name="alpha", color="blue"),
        b=make_label(board, name="Beta", color="red"),
        foreign=make_label(other_board, name="foreign", color="green"),
    )


def _put(client, card, ids, user):
    return client.put(
        f"/api/v1/cards/{card.id}/labels",
        json={"label_ids": [str(i) for i in ids]},
        headers=_auth(user),
    )


def test_set_labels_replaces_and_returns_sorted_labels(client, world):
    response = _put(client, world.card, [world.b.id, world.a.id], world.owner)

    assert response.status_code == 200
    labels = response.get_json()["data"]["labels"]
    assert labels == [
        {"id": str(world.a.id), "name": "alpha", "color": "blue"},
        {"id": str(world.b.id), "name": "Beta", "color": "red"},
    ]

    replaced = _put(client, world.card, [world.b.id], world.owner)
    assert [l["name"] for l in replaced.get_json()["data"]["labels"]] == ["Beta"]


def test_empty_list_clears_labels(client, world, attach_label):
    attach_label(world.card, world.a)

    response = _put(client, world.card, [], world.owner)

    assert response.status_code == 200
    assert response.get_json()["data"]["labels"] == []


def test_label_from_another_board_returns_404_and_changes_nothing(client, world, attach_label):
    attach_label(world.card, world.a)

    response = _put(client, world.card, [world.b.id, world.foreign.id], world.owner)

    assert response.status_code == 404
    assert response.get_json()["error"]["code"] == "LABEL_NOT_FOUND"
    assert [l.id for l in world.card.labels] == [world.a.id]


def test_label_of_another_user_returns_404(client, world, make_board, make_label):
    stranger_label = make_label(make_board(world.other), name="stranger")

    response = _put(client, world.card, [stranger_label.id], world.owner)

    assert response.status_code == 404
    assert response.get_json()["error"]["code"] == "LABEL_NOT_FOUND"


def test_unknown_label_id_gives_same_response_as_foreign_label(client, world):
    unknown = _put(client, world.card, [uuid.uuid4()], world.owner)
    foreign = _put(client, world.card, [world.foreign.id], world.owner)

    assert unknown.status_code == foreign.status_code == 404
    assert unknown.get_json() == foreign.get_json()


def test_card_of_another_user_returns_404(client, world):
    response = _put(client, world.card, [world.a.id], world.other)

    assert response.status_code == 404
    assert response.get_json()["error"]["code"] == "CARD_NOT_FOUND"
    assert world.card.labels == []


def test_duplicate_ids_return_400(client, world):
    response = _put(client, world.card, [world.a.id, world.a.id], world.owner)

    assert response.status_code == 400
    assert "label_ids" in response.get_json()["error"]["details"]


def test_more_than_20_ids_return_400(client, world):
    response = _put(client, world.card, [uuid.uuid4() for _ in range(21)], world.owner)

    assert response.status_code == 400
    assert "label_ids" in response.get_json()["error"]["details"]


@pytest.mark.parametrize(
    "body",
    [{}, {"label_ids": "x"}, {"label_ids": ["not-a-uuid"]}, {"label_ids": [], "extra": 1}],
)
def test_invalid_bodies_return_400(client, world, body):
    response = client.put(
        f"/api/v1/cards/{world.card.id}/labels", json=body, headers=_auth(world.owner)
    )

    assert response.status_code == 400
    assert response.get_json()["error"]["code"] == "VALIDATION_ERROR"


def test_exactly_20_labels_are_accepted(client, world, make_label):
    labels = [make_label(world.board, name=f"n{i:02d}") for i in range(20)]

    response = _put(client, world.card, [l.id for l in labels], world.owner)

    assert response.status_code == 200
    assert len(response.get_json()["data"]["labels"]) == 20


def test_set_labels_does_not_change_updated_at(client, world, db_session):
    before = world.card.updated_at

    _put(client, world.card, [world.a.id], world.owner)
    db_session.refresh(world.card)

    assert world.card.updated_at == before


def test_moving_a_card_keeps_its_labels(client, world, make_column, attach_label):
    attach_label(world.card, world.a)
    target = make_column(world.board, name="Other", position=1)

    response = client.patch(
        f"/api/v1/cards/{world.card.id}/position",
        json={"column_id": str(target.id), "order": 0},
        headers=_auth(world.owner),
    )

    assert response.status_code == 200
    assert [l["name"] for l in response.get_json()["data"]["labels"]] == ["alpha"]


def test_labels_are_persisted_on_reread(client, world):
    _put(client, world.card, [world.a.id], world.owner)

    data = client.get(f"/api/boards/{world.board.id}", headers=_auth(world.owner)).get_json()["data"]

    assert [l["name"] for l in data["columns"][0]["cards"][0]["labels"]] == ["alpha"]
