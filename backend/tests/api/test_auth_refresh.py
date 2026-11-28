"""
API tests for POST /api/auth/refresh and POST /api/auth/logout.

Covers:
- Login sets the refresh_token HttpOnly cookie.
- POST /api/auth/refresh with valid cookie → 200 with access_token and user.
- POST /api/auth/refresh with no cookie → 401 MISSING_REFRESH_TOKEN.
- POST /api/auth/refresh with invalid token → 401 INVALID_REFRESH_TOKEN.
- POST /api/auth/refresh with revoked token → 401 INVALID_REFRESH_TOKEN.
- POST /api/auth/logout revokes the token and clears the cookie → 204.
- POST /api/auth/logout with no cookie → 204 (idempotent).
"""

from datetime import datetime, timezone

import pytest

from app.extensions import db
from app.models.refresh_token import RefreshToken

_REGISTER_URL = "/api/auth/register"
_LOGIN_URL = "/api/auth/login"
_REFRESH_URL = "/api/auth/refresh"
_LOGOUT_URL = "/api/auth/logout"


def _register_and_login(client):
    """Helper: register alice and return the full login response."""
    client.post(
        _REGISTER_URL,
        json={"name": "Alice", "email": "alice@refresh.com", "password": "TestPass1"},
    )
    return client.post(
        _LOGIN_URL,
        json={"email": "alice@refresh.com", "password": "TestPass1"},
    )


# ---------------------------------------------------------------------------
# Login sets the cookie
# ---------------------------------------------------------------------------

def test_login_sets_httponly_refresh_cookie(client):
    resp = _register_and_login(client)

    assert resp.status_code == 200
    cookie_header = resp.headers.get("Set-Cookie", "")
    assert "refresh_token=" in cookie_header
    assert "HttpOnly" in cookie_header
    assert "SameSite=None" in cookie_header


def test_login_response_still_contains_access_token(client):
    resp = _register_and_login(client)

    assert resp.status_code == 200
    data = resp.get_json()["data"]
    assert "access_token" in data
    assert "user" in data


# ---------------------------------------------------------------------------
# POST /api/auth/refresh
# ---------------------------------------------------------------------------

def test_refresh_with_valid_cookie_returns_200_with_access_token(client):
    _register_and_login(client)  # cookie is now set on the test client

    resp = client.post(_REFRESH_URL)

    assert resp.status_code == 200
    data = resp.get_json()["data"]
    assert "access_token" in data
    assert "user" in data
    assert set(data["user"]) == {"id", "email", "name", "role", "timezone"}


def test_refresh_with_no_cookie_returns_401_missing(client):
    # Do NOT log in first — no cookie.
    resp = client.post(_REFRESH_URL)

    assert resp.status_code == 401
    error = resp.get_json()["error"]
    assert error["code"] == "MISSING_REFRESH_TOKEN"


def test_refresh_with_invalid_token_returns_401(client):
    # Manually set a junk cookie value.
    client.set_cookie("refresh_token", "notavalidtoken", path="/api/auth")

    resp = client.post(_REFRESH_URL)

    assert resp.status_code == 401
    error = resp.get_json()["error"]
    assert error["code"] in ("INVALID_REFRESH_TOKEN", "UNAUTHORIZED")


def test_refresh_with_revoked_token_returns_401(client, db_session):
    _register_and_login(client)

    # Revoke all refresh tokens in the DB.
    tokens = db_session.execute(db.select(RefreshToken)).scalars().all()
    for t in tokens:
        t.revoked = True
    db_session.flush()

    resp = client.post(_REFRESH_URL)

    assert resp.status_code == 401
    error = resp.get_json()["error"]
    assert error["code"] in ("INVALID_REFRESH_TOKEN", "UNAUTHORIZED")


def test_refresh_with_expired_token_returns_401(client, db_session):
    _register_and_login(client)

    # Back-date all refresh tokens.
    tokens = db_session.execute(db.select(RefreshToken)).scalars().all()
    for t in tokens:
        t.expires_at = datetime(2000, 1, 1, tzinfo=timezone.utc)
    db_session.flush()

    resp = client.post(_REFRESH_URL)

    assert resp.status_code == 401
    error = resp.get_json()["error"]
    assert error["code"] in ("INVALID_REFRESH_TOKEN", "UNAUTHORIZED")


# ---------------------------------------------------------------------------
# POST /api/auth/logout
# ---------------------------------------------------------------------------

def test_logout_returns_204_and_clears_cookie(client, db_session):
    _register_and_login(client)

    resp = client.post(_LOGOUT_URL)

    assert resp.status_code == 204
    # Cookie should be cleared (max-age=0).
    set_cookie = resp.headers.get("Set-Cookie", "")
    assert "refresh_token=" in set_cookie
    assert "Max-Age=0" in set_cookie or "expires=" in set_cookie.lower()


def test_logout_revokes_refresh_token_in_db(client, db_session):
    _register_and_login(client)

    client.post(_LOGOUT_URL)

    tokens = db_session.execute(db.select(RefreshToken)).scalars().all()
    # At least one token must exist and all must be revoked.
    assert len(tokens) > 0
    assert all(t.revoked for t in tokens)


def test_logout_with_no_cookie_returns_204(client):
    # No login — no cookie.
    resp = client.post(_LOGOUT_URL)

    assert resp.status_code == 204


def test_refresh_fails_after_logout(client, db_session):
    """After logout the refresh cookie is cleared and the token is revoked."""
    _register_and_login(client)
    client.post(_LOGOUT_URL)

    resp = client.post(_REFRESH_URL)

    assert resp.status_code == 401
