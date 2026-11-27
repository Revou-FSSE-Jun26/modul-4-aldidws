"""Round-trip test: downgrade to b3p0r10r1ty, then upgrade back to head."""
import os
os.environ['APP_ENV'] = 'testing'
os.environ['DATABASE_URL'] = 'postgresql://postgres:aldi17@localhost:5432/revotask_test'
os.environ['JWT_SECRET_KEY'] = 'test-secret'

from app import create_app
from flask_migrate import upgrade, downgrade
from sqlalchemy import text

app = create_app()
with app.app_context():
    from app.extensions import db
    # 1. Check current state
    with db.engine.connect() as conn:
        v = conn.execute(text("SELECT version_num FROM alembic_version")).fetchall()
        print("Before downgrade:", [r[0] for r in v])

    # 2. Downgrade to b3p0r10r1ty
    downgrade(revision='b3p0r10r1ty')
    print("Downgraded to b3p0r10r1ty")
    with db.engine.connect() as conn:
        v = conn.execute(text("SELECT version_num FROM alembic_version")).fetchall()
        print("After downgrade:", [r[0] for r in v])
        # Verify is_favorite column is gone
        cols = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='boards' ORDER BY ordinal_position")).fetchall()
        print("boards columns after downgrade:", [r[0] for r in cols])

    # 3. Upgrade back to head
    upgrade()
    print("Upgraded back to head")
    with db.engine.connect() as conn:
        v = conn.execute(text("SELECT version_num FROM alembic_version")).fetchall()
        print("After upgrade:", [r[0] for r in v])
        cols = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='boards' ORDER BY ordinal_position")).fetchall()
        print("boards columns after upgrade:", [r[0] for r in cols])

print("Round-trip PASSED")
