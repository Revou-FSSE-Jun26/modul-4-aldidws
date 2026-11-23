"""
Unit tests for app.blueprints.auth.service.

Each test uses a rolled-back PostgreSQL session so there is no cross-test
state.

Scenarios covered
-----------------
1. Successful registration inserts a User with a normalised email, hashed
   password, and role='member'.
2. Registering the same email twice raises ResourceConflictException.
3. Successful login returns (user, access_token, raw_refresh_token) where
   the JWT sub claim equals str(user.id) and a RefreshToken row is persisted.
4. Login with the wrong password raises InvalidCredentialsError.
"""

import jwt
import pytest

from app.blueprints.auth.service import login_user, register_user
from app.common.exceptions import InvalidCredentialsError, ResourceConflictException
from app.extensions import db
from app.models.refresh_token import RefreshToken
from app.models.user import User


_JWT_SECRET = "test-secret-key-for-tests-only"


# ---------------------------------------------------------------------------
# Test 1 — successful registration
# ---------------------------------------------------------------------------

def test_register_user_success(app_ctx, db_session):
    """register_user normalises the email, hashes the password, sets
    role='member', and persists the user to the database."""
    user = register_user("Test@Example.com ", "TestPass1!")

    assert isinstance(user, User)
    assert user.email == "test@example.com"
    assert user.password_hash != "TestPass1!"
    assert user.role == "member"

    persisted = db_session.execute(
        db.select(User).where(User.email == "test@example.com")
    ).scalar_one_or_none()
    assert persisted is not None
    assert persisted.id == user.id


# ---------------------------------------------------------------------------
# Test 2 — duplicate email raises conflict
# ---------------------------------------------------------------------------

def test_register_duplicate_email_raises_conflict(app_ctx, db_session):
    """Registering the same email address a second time raises
    ResourceConflictException."""
    register_user("dup@example.com", "TestPass1!")

    with pytest.raises(ResourceConflictException):
        register_user("dup@example.com", "TestPass1!")


# ---------------------------------------------------------------------------
# Test 3 — successful login
# ---------------------------------------------------------------------------

def test_login_user_success(app_ctx, db_session):
    """login_user returns (user, access_token, raw_refresh_token).

    The access token must be a valid HS256 JWT whose ``sub`` claim equals
    str(user.id).  A RefreshToken row for the user must exist in the
    database.
    """
    user = register_user("login@example.com", "TestPass1!")

    result = login_user("login@example.com", "TestPass1!")

    assert isinstance(result, tuple)
    assert len(result) == 3

    returned_user, access_token, raw_refresh_token = result

    # Token is a non-empty string and has the three-part JWT structure.
    assert isinstance(access_token, str) and access_token
    assert access_token.count(".") == 2, (
        f"Expected a JWT with two dots (header.payload.signature), got: {access_token!r}"
    )

    # JWT sub claim matches the registered user's id.
    payload = jwt.decode(
        access_token,
        _JWT_SECRET,
        algorithms=["HS256"],
    )
    assert payload["sub"] == str(user.id)

    # Raw refresh token is a non-empty string.
    assert isinstance(raw_refresh_token, str) and raw_refresh_token

    # A RefreshToken row was persisted for this user.
    token_row = db_session.execute(
        db.select(RefreshToken).where(RefreshToken.user_id == user.id)
    ).scalar_one_or_none()
    assert token_row is not None


# ---------------------------------------------------------------------------
# Test 4 — wrong password raises invalid credentials
# ---------------------------------------------------------------------------

def test_login_wrong_password_raises_invalid_credentials(app_ctx, db_session):
    """Supplying the wrong password raises InvalidCredentialsError."""
    register_user("wrongpw@example.com", "TestPass1!")

    with pytest.raises(InvalidCredentialsError):
        login_user("wrongpw@example.com", "WrongPassword1!")
