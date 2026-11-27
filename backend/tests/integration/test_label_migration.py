"""Migration test for labels and card_labels (revision 43535c2f36bf)."""
from pathlib import Path

from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from flask_migrate import downgrade, upgrade
from sqlalchemy import inspect, text

MIGRATIONS_DIR = str(Path(__file__).resolve().parents[2] / "migrations")
PREVIOUS = "421f6e5e8ae5"
REVISION = "43535c2f36bf"


def _tables(engine):
    return set(inspect(engine).get_table_names())


def _constraint_names(conn):
    rows = conn.execute(
        text(
            "select conname from pg_constraint "
            "where conrelid in ('labels'::regclass, 'card_labels'::regclass) "
            "and contype in ('p', 'f', 'c', 'u')"  # PostgreSQL 18 also lists NOT NULL ('n')
        )
    ).scalars()
    return set(rows)


def test_upgrade_downgrade_upgrade_names_index_and_no_drift(migration_app):
    from app.extensions import db

    with migration_app.app_context():
        engine = db.engine
        upgrade(directory=MIGRATIONS_DIR, revision=PREVIOUS)
        assert not {"labels", "card_labels"} & _tables(engine)

        upgrade(directory=MIGRATIONS_DIR)
        assert {"labels", "card_labels"} <= _tables(engine)

        downgrade(directory=MIGRATIONS_DIR, revision=PREVIOUS)
        assert not {"labels", "card_labels"} & _tables(engine)
        assert "due_date" in {c["name"] for c in inspect(engine).get_columns("cards")}

        upgrade(directory=MIGRATIONS_DIR, revision=REVISION)
        with engine.connect() as conn:
            assert conn.execute(text("select version_num from alembic_version")).scalar() == REVISION
        # Later revisions add columns the models already know; check drift at head.
        upgrade(directory=MIGRATIONS_DIR)
        with engine.connect() as conn:
            assert _constraint_names(conn) == {
                "pk_labels",
                "fk_labels_board_id_boards",
                "ck_labels_color",
                "ck_labels_name_not_blank",
                "pk_card_labels",
                "fk_card_labels_card_id_cards",
                "fk_card_labels_label_id_labels",
            }
            indexes = {
                r.indexname: r.indexdef
                for r in conn.execute(
                    text(
                        "select indexname, indexdef from pg_indexes "
                        "where tablename in ('labels', 'card_labels')"
                    )
                )
            }
            assert "ix_card_labels_label_id" in indexes
            unique = indexes["uq_labels_board_id_lower_name"]
            assert "CREATE UNIQUE INDEX" in unique
            assert "lower((name)::text)" in unique
            assert "board_id" in unique
            diff = compare_metadata(MigrationContext.configure(conn), db.metadata)
        assert diff == []


def test_migration_leaves_existing_tables_and_rows_untouched(migration_app):
    from app.extensions import db

    with migration_app.app_context():
        upgrade(directory=MIGRATIONS_DIR, revision=PREVIOUS)
        with db.engine.begin() as conn:
            conn.execute(text(
                "insert into users (id, email, password_hash) "
                "values ('00000000-0000-4000-8000-000000000011', 'mig2@example.com', 'x')"
            ))
            conn.execute(text(
                "insert into boards (id, owner_id, name) values "
                "('00000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000011', 'B')"
            ))
        upgrade(directory=MIGRATIONS_DIR)
        with db.engine.connect() as conn:
            assert conn.execute(text("select name from boards")).scalar() == "B"
            assert conn.execute(text("select count(*) from labels")).scalar() == 0
