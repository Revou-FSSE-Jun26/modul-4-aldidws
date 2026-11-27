"""Reset test DB alembic_version to empty so full upgrade can run."""
import sys
import psycopg

test_db_url = sys.argv[1]
conn = psycopg.connect(test_db_url, autocommit=True)

# Check tables
cur = conn.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='public'")
tables = [r[0] for r in cur]
print("Tables before:", tables)

# Drop all tables to start fresh (keeping alembic_version empty)
for t in tables:
    if t != 'alembic_version':
        conn.execute(f'DROP TABLE IF EXISTS "{t}" CASCADE')
        print(f"Dropped: {t}")

# Delete all version rows
conn.execute("DELETE FROM alembic_version")
print("Alembic version cleared")
conn.close()
