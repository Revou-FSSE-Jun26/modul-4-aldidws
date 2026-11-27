"""Migration test for ``cards.due_date`` (revision 421f6e5e8ae5)."""
from pathlib import Path

from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from flask_migrate import downgrade, upgrade
from sqlalchemy import inspect, text

MIGRATIONS_DIR = str(Path(__file__).resolve().parents[2] / "migrations")

PREVIOUS = "e75e73442f21"
REVISION = "421f6e5e8ae5"


def _head():
    """Current head revision; later migrations chain after REVISION."""
    from alembic.config import Config
    from alembic.script import ScriptDirectory

    cfg = Config()
    cfg.set_main_option("script_location", MIGRATIONS_DIR)
    return ScriptDirectory.from_config(cfg).get_current_head()


def _columns(engine):
    return {c["name"]: c for c in inspect(engine).get_columns("cards")}


def test_upgrade_downgrade_upgrade_and_no_model_drift(migration_app):
    from app.extensions import db

    with migration_app.app_context():
        engine = db.engine

        upgrade(directory=MIGRATIONS_DIR, revision=PREVIOUS)
        assert "due_date" not in _columns(engine)

        upgrade(directory=MIGRATIONS_DIR)
        column = _columns(engine)["due_date"]
        assert column["nullable"] is True
        assert column["type"].timezone is True
        assert column["default"] is None

        downgrade(directory=MIGRATIONS_DIR, revision=PREVIOUS)
        assert "due_date" not in _columns(engine)

        upgrade(directory=MIGRATIONS_DIR)
        assert "due_date" in _columns(engine)

        with engine.connect() as conn:
            assert conn.execute(text("select version_num from alembic_version")).scalar() == _head()
            diff = compare_metadata(MigrationContext.configure(conn), db.metadata)
        assert diff == []


def test_existing_rows_get_null_due_date(migration_app):
    from app.extensions import db

    with migration_app.app_context():
        upgrade(directory=MIGRATIONS_DIR, revision=PREVIOUS)
        with db.engine.begin() as conn:
            conn.execute(text(
                "insert into users (id, email, password_hash) "
                "values ('00000000-0000-4000-8000-000000000001', 'mig@example.com', 'x')"
            ))
            conn.execute(text(
                "insert into boards (id, owner_id, name) values "
                "('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', 'B')"
            ))
            conn.execute(text(
                "insert into board_columns (id, board_id, name, position) values "
                "('00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000002', 'C', 0)"
            ))
            conn.execute(text(
                "insert into cards (id, column_id, owner_id, title, \"order\") values "
                "('00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000003', "
                "'00000000-0000-4000-8000-000000000001', 'Old card', 0)"
            ))

        upgrade(directory=MIGRATIONS_DIR)

        with db.engine.connect() as conn:
            row = conn.execute(text("select title, due_date from cards")).one()
        assert row.title == "Old card"
        assert row.due_date is None
