"""Fixtures for tests that run the real Alembic migrations.

``migration_app`` creates a throw-away PostgreSQL database on the server of
``TEST_DATABASE_URL``, builds a Flask app that points at it, and drops it
afterwards. The URL and password are never printed. When the role may not
create databases, the tests are skipped with a visible reason and must be
reported as "not verified".
"""
import sys
import types
import uuid

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url


@pytest.fixture()
def migration_app():
    from tests.conftest import _test_database_url

    base_url = make_url(_test_database_url())
    db_name = f"revotask_mig_{uuid.uuid4().hex[:8]}"
    admin_engine = create_engine(base_url, isolation_level="AUTOCOMMIT")
    try:
        with admin_engine.connect() as conn:
            conn.execute(text(f'CREATE DATABASE "{db_name}"'))
    except Exception as exc:  # noqa: BLE001 - any failure means we cannot verify
        admin_engine.dispose()
        pytest.skip(f"CREATE DATABASE not permitted or server unavailable ({type(exc).__name__})")

    module_name = f"_mig_config_{db_name}"
    config_module = types.ModuleType(module_name)

    class MigrationConfig:
        TESTING = True
        SECRET_KEY = "migration-test-secret"
        JWT_SECRET_KEY = "migration-test-secret"
        SQLALCHEMY_DATABASE_URI = base_url.set(database=db_name).render_as_string(
            hide_password=False
        )
        SQLALCHEMY_TRACK_MODIFICATIONS = False
        CORS_ALLOWED_ORIGINS: list[str] = []

    config_module.MigrationConfig = MigrationConfig
    sys.modules[module_name] = config_module

    from app import create_app

    app = create_app(f"{module_name}.MigrationConfig")
    try:
        yield app
    finally:
        from app.extensions import db

        with app.app_context():
            db.session.remove()
            db.engine.dispose()
        sys.modules.pop(module_name, None)
        with admin_engine.connect() as conn:
            conn.execute(text(f'DROP DATABASE IF EXISTS "{db_name}" WITH (FORCE)'))
        admin_engine.dispose()
