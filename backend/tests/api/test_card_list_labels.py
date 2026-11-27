"""Labels and query count of GET /api/v1/cards (route 26)."""
import pytest

from tests.conftest import count_selects, make_jwt

URL = "/api/v1/cards"
# Measured with two data sizes: the total count, the cards page and the
# selectin load of card_labels. Board and column data come from joins.
EXPECTED_LIST_QUERIES = 3


def _auth(user) -> dict:
    return {"Authorization": f"Bearer {make_jwt(user.id)}"}


@pytest.mark.parametrize("cards, label_count", [(3, 2), (12, 40)])
def test_list_cards_query_count_is_fixed(
    client, db_session, make_user, make_board, make_column, make_card, make_label,
    attach_label, cards, label_count,
):
    user = make_user()
    board = make_board(user)
    col = make_column(board)
    labels = [make_label(board, name=f"L{i:03d}") for i in range(label_count)]
    for i in range(cards):
        card = make_card(col, user, order=i)
        attach_label(card, labels[i % label_count], labels[(i + 1) % label_count])

    response, reads = count_selects(db_session, lambda: client.get(URL, headers=_auth(user)))

    assert response.status_code == 200
    assert all(len(c["labels"]) == 2 for c in response.get_json()["data"])
    assert len(reads) == EXPECTED_LIST_QUERIES, reads


def test_list_cards_includes_sorted_labels(
    client, make_user, make_board, make_column, make_card, make_label, attach_label
):
    user = make_user()
    board = make_board(user)
    card = make_card(make_column(board), user)
    attach_label(card, make_label(board, name="zeta", color="red"), make_label(board, name="Alpha"))

    data = client.get(URL, headers=_auth(user)).get_json()["data"]

    assert [l["name"] for l in data[0]["labels"]] == ["Alpha", "zeta"]
