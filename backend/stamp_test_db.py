"""
Stamp the test database with the current head revision after create_all
has built the schema. This matches the approach used in production: migrations
are only used to ALTER existing tables, so we stamp the test DB to avoid
re-running them on a freshly created schema.
"""
import os
import sys

test_db_url = sys.argv[1]
head_rev = sys.argv[2] if len(sys.argv) > 2 else "b3p0r10r1ty"

import psycopg
conn = psycopg.connect(test_db_url, autocommit=True)

# Upsert the alembic_version row
conn.execute("DELETE FROM alembic_version")
conn.execute("INSERT INTO alembic_version (version_num) VALUES (%s)", (head_rev,))
print(f"Stamped test DB with revision: {head_rev}")
conn.close()
