"""Upgrade dev DB to d3f4v0r1t3."""
import os
os.environ['APP_ENV'] = 'development'
os.environ['DATABASE_URL'] = 'postgresql://postgres:aldi17@localhost:5432/RevoTask'
os.environ['JWT_SECRET_KEY'] = 'dev-secret-change-me'

from app import create_app
from flask_migrate import upgrade
from sqlalchemy import text

app = create_app()
with app.app_context():
    upgrade()
    print("Upgraded dev DB")
    from app.extensions import db
    with db.engine.connect() as conn:
        v = conn.execute(text("SELECT version_num FROM alembic_version")).fetchall()
        print("Dev DB version:", [r[0] for r in v])
        cols = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='boards' ORDER BY ordinal_position")).fetchall()
        print("boards columns:", [r[0] for r in cols])
