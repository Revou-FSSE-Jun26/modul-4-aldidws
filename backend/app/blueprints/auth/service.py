"""
Auth service.

Contains the business logic for authentication operations.  Every function
here MUST:

- Remain independent of Flask request and response objects.
- Raise typed ``AppException`` subclasses for expected failures.
- Never log passwords, tokens, or secrets.
"""

import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone

import jwt
from flask import current_app
from werkzeug.security import check_password_hash, generate_password_hash

from app.common.exceptions import InvalidCredentialsError, ResourceConflictException
from app.extensions import db
from app.models.refresh_token import RefreshToken
from app.models.user import User


def register_user(email: str, password: str, name: str) -> User:
    """Register a new user account.

    Args:
        name: The user's display name (surrounding whitespace is stripped).
        email: The prospective user's email address.
        password: The plaintext password (hashed before storage).

    Returns:
        The newly created ``User`` instance.

    Raises:
        ResourceConflictException: When the email address is already in use.
    """
    normalised_email = email.lower().strip()

    existing = db.session.execute(
        db.select(User).where(User.email == normalised_email)
    ).scalar_one_or_none()

    if existing is not None:
        raise ResourceConflictException(
            message="A conflict occurred. Please try again."
        )

    user = User(
        email=normalised_email,
        name=name.strip(),
        password_hash=generate_password_hash(password),
        role="member",
        timezone="UTC",
    )

    db.session.add(user)
    db.session.commit()

    return user


def login_user(email: str, password: str) -> tuple[User, str, str]:
    """Authenticate a user and issue access and refresh tokens.

    Args:
        email: The user's email address.
        password: The plaintext password to verify.

    Returns:
        A three-tuple of ``(user, access_token, raw_refresh_token)``.

    Raises:
        InvalidCredentialsError: When the email or password is incorrect.
    """
    normalised_email = email.lower().strip()

    user = db.session.execute(
        db.select(User).where(User.email == normalised_email)
    ).scalar_one_or_none()

    if user is None or not check_password_hash(user.password_hash, password):
        raise InvalidCredentialsError()

    # Build the short-lived access token.
    access_token = jwt.encode(
        {
            "sub": str(user.id),
            "role": user.role,
            "exp": datetime.now(timezone.utc) + timedelta(minutes=15),
        },
        current_app.config["JWT_SECRET_KEY"],
        algorithm="HS256",
    )

    # Build the opaque refresh token and persist its hash.
    raw_refresh_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_refresh_token.encode()).hexdigest()

    refresh_token = RefreshToken(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=datetime.now(timezone.utc) + timedelta(days=7),
        revoked=False,
    )

    db.session.add(refresh_token)
    db.session.commit()

    return user, access_token, raw_refresh_token
