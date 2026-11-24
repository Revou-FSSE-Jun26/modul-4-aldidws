"""
Pytest configuration and shared fixtures for the test suite.

Isolation strategy
------------------
Each test runs inside a rolled-back outer transaction so the database is
left clean for the next test, with no teardown SQL required.

SQLAlchemy 2.x Session with ``join_transaction_mode='conditional_savepoint'``
(the default) participates in the outer connection transaction instead of
committing through it.  When service code calls ``session.commit()``, the ORM
releases a SAVEPOINT rather than committing to disk.  After each test the
outer ``transaction.rollback()`` discards every change.

The Flask-SQLAlchemy ``db.session`` proxy is replaced for each test using
``unittest.mock.patch.object`` so that service code that imports ``db`` from
``app.extensions`` and accesses ``db.session`` at call time will use the
isolated test session.
"""

import os
import sys
import types as _types
import uuid

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from werkzeug.security import generate_password_hash


# ---------------------------------------------------------------------------
# TestConfig — registered into sys.modules so create_app can import it by
# dotted-path string without requiring a file on disk.
# ---------------------------------------------------------------------------

# Password-free default. Put the real credentials in TEST_DATABASE_URL (or in
# PGPASSWORD / a pgpass file); never commit them here.
_DEFAULT_TEST_DATABASE_URL = "postgresql://postgres@localhost:5432/revotask_test"


def _test_database_url() -> str:
    return os.environ.get("TEST_DATABASE_URL", _DEFAULT_TEST_DATABASE_URL)


class _TestConfig:
    TESTING = True
    SQLALCHEMY_DATABASE_URI = _test_database_url()
    JWT_SECRET_KEY = "test-secret-key-for-tests-only"
    WTF_CSRF_ENABLED = False
    SQLALCHEMY_TRACK_MODIFICATIONS = False


_mod = _types.ModuleType("_test_config")
_mod.TestConfig = _TestConfig
sys.modules["_test_config"] = _mod


# ---------------------------------------------------------------------------
# Session-scoped fixtures (created once per pytest run)
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def engine():
    """Create the SQLAlchemy engine pointing at the test database."""
    return create_engine(_test_database_url())


@pytest.fixture(scope="session")
def tables(engine):
    """Create all tables before the test session and drop them afterwards."""
    # Import every model so SQLAlchemy's MetaData knows about all tables.
    from app.models import (  # noqa: F401 — side-effect imports
        User,
        Board,
        BoardColumn,
        Card,
        CardComment,
        RefreshToken,
        Notification,
    )
    from app.extensions import db

    db.metadata.create_all(engine)
    yield
    db.metadata.drop_all(engine)


@pytest.fixture(scope="session")
def flask_app():
    """Create the Flask application configured for testing."""
    from app import create_app

    app = create_app("_test_config.TestConfig")
    return app


# ---------------------------------------------------------------------------
# Function-scoped fixtures (created fresh for each test)
# ---------------------------------------------------------------------------

@pytest.fixture()
def db_session(engine, tables):
    """
    Yield an isolated SQLAlchemy Session for a single test.

    The session is bound to a connection that holds an open outer transaction.
    SQLAlchemy's default ``join_transaction_mode='conditional_savepoint'``
    means ``session.commit()`` inside service code only releases a SAVEPOINT
    rather than committing to disk.  The outer transaction is rolled back
    after the test so no data persists.
    """
    connection = engine.connect()
    transaction = connection.begin()

    # Session joined to the already-begun connection transaction.
    # join_transaction_mode defaults to 'conditional_savepoint' in SA 2.x,
    # which is exactly the behaviour we need.
    session = Session(bind=connection)

    yield session

    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture()
def app_ctx(flask_app, db_session):
    """
    Push a Flask application context and patch ``db.session`` with the
    isolated test session for the duration of one test.
    """
    from unittest.mock import patch
    from app.extensions import db

    with flask_app.app_context():
        with patch.object(db, "session", db_session):
            yield


# ---------------------------------------------------------------------------
# Factory fixtures — callable helpers used inside test functions
# ---------------------------------------------------------------------------

@pytest.fixture()
def make_user(db_session):
    """Return a factory that inserts a User row and returns the instance."""

    def _factory(
        email: str | None = None,
        password: str = "TestPass1!",
        role: str = "member",
        timezone: str = "UTC",
    ):
        from app.models.user import User

        if email is None:
            email = f"user_{uuid.uuid4().hex[:8]}@example.com"

        user = User(
            email=email.lower().strip(),
            password_hash=generate_password_hash(password),
            role=role,
            timezone=timezone,
        )
        db_session.add(user)
        db_session.flush()
        return user

    return _factory


@pytest.fixture()
def make_board(db_session):
    """Return a factory that inserts a Board row and returns the instance."""

    def _factory(owner, name: str | None = None):
        from app.models.board import Board

        board = Board(
            owner_id=owner.id,
            name=name or f"Board {uuid.uuid4().hex[:6]}",
        )
        db_session.add(board)
        db_session.flush()
        return board

    return _factory


@pytest.fixture()
def make_column(db_session):
    """Return a factory that inserts a BoardColumn row and returns the instance."""

    def _factory(board, name: str | None = None, position: int = 0):
        from app.models.board_column import BoardColumn

        col = BoardColumn(
            board_id=board.id,
            name=name or f"Column {uuid.uuid4().hex[:6]}",
            position=position,
        )
        db_session.add(col)
        db_session.flush()
        return col

    return _factory


@pytest.fixture()
def make_card(db_session):
    """Return a factory that inserts a Card row and returns the instance."""

    def _factory(column, owner, title: str | None = None, order: float = 0.0):
        from app.models.card import Card

        card = Card(
            column_id=column.id,
            owner_id=owner.id,
            title=title or f"Card {uuid.uuid4().hex[:6]}",
            order=order,
        )
        db_session.add(card)
        db_session.flush()
        return card

    return _factory


# ---------------------------------------------------------------------------
# Seeded fixture — pre-built graph for card-service tests
# ---------------------------------------------------------------------------

@pytest.fixture()
def seeded(db_session, make_user, make_board, make_column, make_card):
    """Return a namespace with a fully-seeded board graph.

    Graph
    -----
    user  ──owns──▶  board
                       ├── col_a  ──contains──▶  card     (order=0)
                       │                   └──▶  sibling  (order=1)
                       └── col_b  (empty)

    Both ``card`` and ``sibling`` are owned by ``user`` and live in ``col_a``.
    ``col_b`` is an empty column in the same board, available for cross-column
    move tests.
    """
    import types

    user = make_user(email="seeded@example.com")
    board = make_board(user, name="Seeded Board")
    col_a = make_column(board, name="Col A", position=0)
    col_b = make_column(board, name="Col B", position=1)
    card = make_card(col_a, user, title="Seeded Card", order=0)
    sibling = make_card(col_a, user, title="Sibling Card", order=1)

    ns = types.SimpleNamespace(
        user=user,
        board=board,
        col_a=col_a,
        col_b=col_b,
        card=card,
        sibling=sibling,
    )
    return ns


# ---------------------------------------------------------------------------
# HTTP test client fixture
# ---------------------------------------------------------------------------

@pytest.fixture()
def client(flask_app, db_session):
    """Yield a Flask test client with ``db.session`` patched to the isolated
    test session.

    ``token_required`` calls ``db.session.get(User, ...)`` at request time,
    so the patch must be active for the full duration of each request, not
    just during fixture setup.  Using ``unittest.mock.patch.object`` as a
    context manager around the ``with flask_app.test_client()`` block
    satisfies this requirement.
    """
    from unittest.mock import patch
    from app.extensions import db

    with flask_app.app_context():
        with patch.object(db, "session", db_session):
            with flask_app.test_client() as test_client:
                yield test_client


def make_jwt(user_id, secret: str = "test-secret-key-for-tests-only") -> str:
    """Return a signed HS256 JWT for *user_id* (helper used in test modules)."""
    import datetime
    import jwt as _jwt

    payload = {
        "sub": str(user_id),
        "exp": datetime.datetime.now(datetime.timezone.utc)
        + datetime.timedelta(minutes=15),
    }
    return _jwt.encode(payload, secret, algorithm="HS256")
