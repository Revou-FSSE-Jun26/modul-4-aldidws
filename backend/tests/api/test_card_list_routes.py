"""API tests for GET /api/v1/cards (search, filters, pagination)."""

from datetime import datetime, timezone

import pytest

from tests.conftest import make_jwt

URL = "/api/v1/cards"


def _auth(user) -> dict:
    return {"Authorization": f"Bearer {make_jwt(user.id)}"}


@pytest.fixture()
def world(make_user, make_board, make_column, make_card):
    """User A with two boards and cards; user B with a card that must never leak."""
    import types

    a = make_user()
    b = make_user()
    board1 = make_board(a, name="Alpha")
    board2 = make_board(a, name="Beta")
    col1 = make_column(board1, name="Todo", position=0)
    col2 = make_column(board2, name="Doing", position=0)
    c1 = make_card(col1, a, title="Fix Login bug", order=0)
    c1.description = "Users cannot sign in"
    c2 = make_card(col1, a, title="Write docs", order=1)
    c3 = make_card(col2, a, title="Deploy", order=0)
    c3.description = "Roll out LOGIN page"
    bcol = make_column(make_board(b, name="Gamma"))
    secret = make_card(bcol, b, title="Login secret", order=0)
    return types.SimpleNamespace(
        a=a, b=b, board1=board1, board2=board2, c1=c1, c2=c2, c3=c3, secret=secret
    )


def _titles(response):
    return [c["title"] for c in response.get_json()["data"]]


def test_list_without_token_returns_401(client):
    assert client.get(URL).status_code == 401


def test_list_returns_only_own_cards_with_context(client, world):
    response = client.get(URL, headers=_auth(world.a))

    assert response.status_code == 200
    body = response.get_json()
    assert _titles(response) == ["Fix Login bug", "Write docs", "Deploy"]
    assert body["meta"] == {"page": 1, "per_page": 20, "total": 3}
    first = body["data"][0]
    assert first["board_id"] == str(world.board1.id)
    assert first["board_name"] == "Alpha"
    assert first["column_name"] == "Todo"
    assert set(first) == {
        "id", "column_id", "owner_id", "title", "description", "order",
        "deleted_at", "created_at", "updated_at",
        "board_id", "board_name", "column_name",
    }


def test_search_is_case_insensitive_over_title_and_description(client, world):
    response = client.get(URL, query_string={"search": "login"}, headers=_auth(world.a))

    assert response.status_code == 200
    assert sorted(_titles(response)) == ["Deploy", "Fix Login bug"]


def test_search_never_returns_other_users_cards(client, world):
    response = client.get(URL, query_string={"search": "secret"}, headers=_auth(world.a))

    assert response.status_code == 200
    assert _titles(response) == []
    assert response.get_json()["meta"]["total"] == 0
    other = client.get(URL, query_string={"search": "secret"}, headers=_auth(world.b))
    assert _titles(other) == ["Login secret"]


@pytest.mark.parametrize("term", ["%", "_", "100%", "a_b"])
def test_search_treats_wildcards_literally(client, make_user, make_board, make_column, make_card, term):
    user = make_user()
    col = make_column(make_board(user))
    make_card(col, user, title="plain title")
    make_card(col, user, title="100% done")
    make_card(col, user, title="snake_case name")

    response = client.get(URL, query_string={"search": term}, headers=_auth(user))

    assert response.status_code == 200
    expected = {
        "%": ["100% done"],
        "_": ["snake_case name"],
        "100%": ["100% done"],
        "a_b": [],
    }[term]
    assert _titles(response) == expected


def test_search_with_sql_looking_input_returns_normal_empty_result(client, world):
    response = client.get(
        URL, query_string={"search": "'; DROP TABLE cards; --"}, headers=_auth(world.a)
    )

    assert response.status_code == 200
    assert _titles(response) == []
    assert len(_titles(client.get(URL, headers=_auth(world.a)))) == 3


def test_board_id_filter(client, world):
    response = client.get(
        URL, query_string={"board_id": str(world.board2.id)}, headers=_auth(world.a)
    )

    assert _titles(response) == ["Deploy"]


def test_foreign_board_id_returns_empty_list(client, world):
    foreign = world.secret.column.board_id

    response = client.get(URL, query_string={"board_id": str(foreign)}, headers=_auth(world.a))

    assert response.status_code == 200
    assert _titles(response) == []


def test_mine_returns_only_cards_created_by_caller(client, db_session, world, make_card):
    other_created = make_card(world.c1.column, world.b, title="By someone else")
    assert other_created.owner_id == world.b.id

    mine = client.get(URL, query_string={"mine": "true"}, headers=_auth(world.a))
    everything = client.get(URL, headers=_auth(world.a))

    assert "By someone else" not in _titles(mine)
    assert len(_titles(mine)) == 3
    assert "By someone else" in _titles(everything)


def test_soft_deleted_cards_are_excluded(client, db_session, world):
    world.c2.deleted_at = datetime.now(timezone.utc)
    db_session.flush()

    response = client.get(URL, headers=_auth(world.a))

    assert "Write docs" not in _titles(response)
    assert response.get_json()["meta"]["total"] == 2


def test_pagination_meta_and_slice(client, world):
    page1 = client.get(URL, query_string={"per_page": 2, "page": 1}, headers=_auth(world.a))
    page2 = client.get(URL, query_string={"per_page": 2, "page": 2}, headers=_auth(world.a))

    assert _titles(page1) == ["Fix Login bug", "Write docs"]
    assert _titles(page2) == ["Deploy"]
    assert page2.get_json()["meta"] == {"page": 2, "per_page": 2, "total": 3}


@pytest.mark.parametrize(
    "params",
    [
        {"search": "x" * 101},
        {"search": ""},
        {"per_page": 101},
        {"per_page": 0},
        {"page": 0},
        {"page": "abc"},
        {"board_id": "not-a-uuid"},
        {"mine": "maybe"},
        {"unknown": "1"},
        {"sort": "title"},
    ],
)
def test_invalid_query_returns_400(client, world, params):
    response = client.get(URL, query_string=params, headers=_auth(world.a))

    assert response.status_code == 400
    assert response.get_json()["error"]["code"] == "VALIDATION_ERROR"


def test_repeated_query_key_returns_400(client, world):
    response = client.get(f"{URL}?search=a&search=b", headers=_auth(world.a))

    assert response.status_code == 400


def test_search_of_exactly_100_chars_is_accepted(client, world):
    response = client.get(URL, query_string={"search": "x" * 100}, headers=_auth(world.a))

    assert response.status_code == 200
