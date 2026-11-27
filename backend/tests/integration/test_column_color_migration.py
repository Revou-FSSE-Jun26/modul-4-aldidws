"""Migration test for board_columns.color and is_done (revision a2c0l0r5d0n1)."""

from pathlib import Path

import pytest
from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from flask_migrate import downgrade, upgrade
from sqlalchemy import inspect, text
from sqlalchemy.exc import IntegrityError

MIGRATIONS_DIR = str(Path(__file__).resolve().parents[2] / "migrations")
PREVIOUS = "43535c2f36bf"
REVISION = "a2c0l0r5d0n1"

USER_ID = "00000000-0000-4000-8000-000000000021"
BOARD_ID = "00000000-0000-4000-8000-000000000022"
COLUMN_ID = "00000000-0000-4000-8000-000000000023"


def _column_names(engine):
    return {c["name"] for c in inspect(engine).get_columns("board_columns")}


def test_upgrade_downgrade_upgrade_and_no_drift(migration_app):
    from app.extensions import db

    with migration_app.app_context():
        engine = db.engine
        upgrade(directory=MIGRATIONS_DIR, revision=PREVIOUS)
        assert not {"color", "is_done"} & _column_names(engine)

        upgrade(directory=MIGRATIONS_DIR, revision=REVISION)
        assert {"color", "is_done"} <= _column_names(engine)

        downgrade(directory=MIGRATIONS_DIR, revision=PREVIOUS)
        assert not {"color", "is_done"} & _column_names(engine)

        upgrade(directory=MIGRATIONS_DIR, revision=REVISION)
        with engine.connect() as conn:
            assert conn.execute(text("select version_num from alembic_version")).scalar() == REVISION
            assert "ck_board_columns_color" in set(
                conn.execute(
                    text(
                        "select conname from pg_constraint "
                        "where conrelid = 'board_columns'::regclass and contype = 'c'"
                    )
                ).scalars()
            )
            diff = compare_metadata(MigrationContext.configure(conn), db.metadata)
        assert diff == []


def test_existing_columns_get_null_color_and_false_is_done(migration_app):
    from app.extensions import db

    with migration_app.app_context():
        upgrade(directory=MIGRATIONS_DIR, revision=PREVIOUS)
        with db.engine.begin() as conn:
            conn.execute(text(
                f"insert into users (id, email, password_hash) values ('{USER_ID}', 'mig3@example.com', 'x')"
            ))
            conn.execute(text(f"insert into boards (id, owner_id, name) values ('{BOARD_ID}', '{USER_ID}', 'B')"))
            conn.execute(text(
                f"insert into board_columns (id, board_id, name, position) values ('{COLUMN_ID}', '{BOARD_ID}', 'Todo', 0)"
            ))

        upgrade(directory=MIGRATIONS_DIR, revision=REVISION)
        with db.engine.connect() as conn:
            row = conn.execute(text("select name, color, is_done from board_columns")).one()
        assert tuple(row) == ("Todo", None, False)

        with pytest.raises(IntegrityError):
            with db.engine.begin() as conn:
                conn.execute(text(f"update board_columns set color = 'purple' where id = '{COLUMN_ID}'"))
