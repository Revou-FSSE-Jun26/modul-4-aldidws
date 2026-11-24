"""Contract test: request bodies the frontend sends must satisfy the backend schemas.

Reads docs/api/frontend-request-payloads.json, which the frontend contract test
also reads. If a field name drifts on either side, one of the two tests fails.
"""
import importlib
import json
import re
from pathlib import Path

import pytest
from marshmallow import ValidationError

FIXTURE = Path(__file__).resolve().parents[3] / "docs" / "api" / "frontend-request-payloads.json"
REQUESTS = json.loads(FIXTURE.read_text(encoding="utf-8"))["requests"]

SCHEMA_MODULES = [
    "app.blueprints.auth.schema",
    "app.blueprints.boards.schema",
    "app.blueprints.columns.schema",
    "app.blueprints.cards.schema",
    "app.blueprints.comments.schema",
    "app.blueprints.users.schema",
]


def _schema_class(name: str):
    for module_name in SCHEMA_MODULES:
        module = importlib.import_module(module_name)
        if hasattr(module, name):
            return getattr(module, name)
    raise AssertionError(f"Schema {name} not found in {SCHEMA_MODULES}")


def _fill_path(entry: dict) -> str:
    return re.sub(r"\{(\w+)\}", lambda m: entry["pathParams"][m.group(1)], entry["path"])


@pytest.mark.parametrize("key", sorted(REQUESTS))
def test_frontend_body_validates_against_schema(key):
    entry = REQUESTS[key]
    schema = _schema_class(entry["schema"])()
    schema.load(entry["body"])


@pytest.mark.parametrize("key", sorted(REQUESTS))
def test_frontend_body_with_unknown_key_is_rejected(key):
    entry = REQUESTS[key]
    schema = _schema_class(entry["schema"])()
    with pytest.raises(ValidationError) as excinfo:
        schema.load({**entry["body"], "unexpected_field": "x"})
    assert excinfo.value.messages["unexpected_field"] == ["Unknown field."]


@pytest.mark.parametrize("key", sorted(REQUESTS))
def test_frontend_route_exists_in_flask_url_map(flask_app, key):
    entry = REQUESTS[key]
    adapter = flask_app.url_map.bind("localhost")
    endpoint, _ = adapter.match(_fill_path(entry), method=entry["method"])
    assert endpoint


def test_unknown_key_returns_validation_error_envelope(client):
    """A real route turns the unknown-key failure into VALIDATION_ERROR (400)."""
    response = client.post("/api/auth/login", json={**REQUESTS["login"]["body"], "name": "x"})
    assert response.status_code == 400
    payload = response.get_json()
    assert payload["error"]["code"] == "VALIDATION_ERROR"
    assert payload["error"]["details"]["name"] == ["Unknown field."]
