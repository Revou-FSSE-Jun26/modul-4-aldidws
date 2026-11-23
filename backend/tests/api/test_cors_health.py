"""API tests for the CORS allowlist and the unauthenticated health endpoint."""

import pytest

from app import create_app

ALLOWED = "https://app.example.com"
DISALLOWED = "https://evil.example.com"


@pytest.fixture()
def prod_client(monkeypatch):
    monkeypatch.setenv("SECRET_KEY", "dummy-secret-key-value")
    monkeypatch.setenv("JWT_SECRET_KEY", "dummy-jwt-secret-value")
    monkeypatch.setenv("DATABASE_URL", "postgresql://u:dummy@localhost:5432/none")
    monkeypatch.setenv("CORS_ALLOWED_ORIGINS", ALLOWED)
    app = create_app("app.config.ProductionConfig")
    return app.test_client()


def _preflight(client, origin, headers="authorization,content-type"):
    return client.options(
        "/api/boards",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": headers,
        },
    )


def test_preflight_from_allowed_origin_is_accepted(prod_client):
    resp = _preflight(prod_client, ALLOWED)
    assert resp.status_code == 200
    assert resp.headers["Access-Control-Allow-Origin"] == ALLOWED
    assert "POST" in resp.headers["Access-Control-Allow-Methods"]
    assert "Access-Control-Allow-Credentials" not in resp.headers


def test_preflight_from_disallowed_origin_gets_no_cors_headers(prod_client):
    resp = _preflight(prod_client, DISALLOWED)
    assert "Access-Control-Allow-Origin" not in resp.headers


def test_preflight_never_answers_with_wildcard(prod_client):
    for origin in (ALLOWED, DISALLOWED):
        resp = _preflight(prod_client, origin)
        assert resp.headers.get("Access-Control-Allow-Origin") != "*"


def test_preflight_does_not_grant_unlisted_header(prod_client):
    resp = _preflight(prod_client, ALLOWED, headers="x-custom")
    granted = resp.headers.get("Access-Control-Allow-Headers", "").lower()
    assert "x-custom" not in granted


def test_simple_request_from_allowed_origin_gets_header(prod_client):
    resp = prod_client.get("/api/health", headers={"Origin": ALLOWED})
    assert resp.headers["Access-Control-Allow-Origin"] == ALLOWED


def test_simple_request_from_disallowed_origin_gets_no_header(prod_client):
    resp = prod_client.get("/api/health", headers={"Origin": DISALLOWED})
    assert "Access-Control-Allow-Origin" not in resp.headers


def test_health_is_public_and_leaks_nothing(client):
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert resp.get_json()["data"]["status"] == "ok"
    body = resp.get_data(as_text=True)
    for forbidden in ("SECRET_KEY", "JWT_SECRET_KEY", "DATABASE_URL", "postgresql://"):
        assert forbidden not in body
