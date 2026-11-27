import os
os.environ['APP_ENV'] = 'testing'
os.environ['TEST_DATABASE_URL'] = 'postgresql://postgres:aldi17@localhost:5432/revotask_test'
os.environ['DATABASE_URL'] = 'postgresql://postgres:aldi17@localhost:5432/revotask_test'
from sqlalchemy import create_engine, text
e = create_engine('postgresql://postgres:aldi17@localhost:5432/revotask_test')
with e.connect() as conn:
    rows = conn.execute(text("SELECT tablename FROM pg_tables WHERE schemaname='public'")).fetchall()
    print("Tables:", [r[0] for r in rows])
    rows2 = conn.execute(text("SELECT version_num FROM alembic_version")).fetchall() if any(r[0]=='alembic_version' for r in rows) else []
    print("Alembic versions:", [r[0] for r in rows2])
