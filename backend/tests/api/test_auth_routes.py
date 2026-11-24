"""
API tests for POST /api/auth/register.

Regression coverage for the frontend/backend contract: the register page
sends ``name``, ``email`` and ``password``, and the backend must accept and
persist ``name`` while still rejecting unknown fields.
"""

import pytest

from app.extensions import db
from app.models.user import User

_URL = "/api/auth/register"


def _payload(**overrides):
    body = {
        "name": "Alice Example",
        "email": "alice@example.com",
        "password": "TestPass1",
    }
    body.update(overrides)
    return body


def test_register_with_name_returns_201_and_name(client, db_session):
    response = client.post(_URL, json=_payload(name="  Alice Example  "))

    assert response.status_code == 201
    data = response.get_json()["data"]
    assert data["name"] == "Alice Example"
    assert data["email"] == "alice@example.com"

    persisted = db_session.execute(
        db.select(User).where(User.email == "alice@example.com")
    ).scalar_one()
    assert persisted.name == "Alice Example"


def test_register_response_never_contains_password_or_hash(client):
    response = client.post(_URL, json=_payload())

    assert response.status_code == 201
    data = response.get_json()["data"]
    assert "password" not in data
    assert "password_hash" not in data
    assert "TestPass1" not in response.get_data(as_text=True)


def test_register_missing_name_returns_400(client):
    body = _payload()
    del body["name"]

    response = client.post(_URL, json=body)

    assert response.status_code == 400
    error = response.get_json()["error"]
    assert error["code"] == "VALIDATION_ERROR"
    assert "name" in error["details"]


@pytest.mark.parametrize("name", ["", "   ", "\t\n "])
def test_register_empty_or_whitespace_name_returns_400(client, name):
    response = client.post(_URL, json=_payload(name=name))

    assert response.status_code == 400
    assert "name" in response.get_json()["error"]["details"]


def test_register_name_longer_than_255_returns_400(client):
    response = client.post(_URL, json=_payload(name="a" * 256))

    assert response.status_code == 400
    assert "name" in response.get_json()["error"]["details"]


def test_register_name_of_255_characters_is_accepted(client):
    response = client.post(_URL, json=_payload(name="a" * 255))

    assert response.status_code == 201


def test_register_unknown_field_still_returns_400(client):
    response = client.post(_URL, json=_payload(role="admin"))

    assert response.status_code == 400
    assert "role" in response.get_json()["error"]["details"]


def test_register_duplicate_email_returns_409(client):
    assert client.post(_URL, json=_payload()).status_code == 201

    response = client.post(_URL, json=_payload(name="Someone Else"))

    assert response.status_code == 409


@pytest.mark.parametrize(
    "password", ["Short1", "alllowercase1", "ALLUPPERCASE1", "NoDigitsHere"]
)
def test_register_weak_password_returns_400(client, password):
    response = client.post(_URL, json=_payload(password=password))

    assert response.status_code == 400
    assert "password" in response.get_json()["error"]["details"]


_LOGIN_URL = '/api/auth/login'


def test_login_response_user_includes_name(client):
    client.post(_URL, json=_payload())

    response = client.post(
        _LOGIN_URL, json={'email': 'alice@example.com', 'password': 'TestPass1'}
    )

    assert response.status_code == 200
    user = response.get_json()['data']['user']
    assert user['name'] == 'Alice Example'
    assert set(user) == {'id', 'email', 'name', 'role', 'timezone'}

