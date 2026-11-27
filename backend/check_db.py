import os, sys
db_url = sys.argv[1]
import psycopg
conn = psycopg.connect(db_url)
cur = conn.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name")
print("Tables:", [row[0] for row in cur])
cur2 = conn.execute("SELECT version_num FROM alembic_version")
print("Alembic versions:", [row[0] for row in cur2])
# Check if priority column exists
try:
    cur3 = conn.execute("SELECT column_name FROM information_schema.columns WHERE table_name='cards' AND column_name='priority'")
    print("priority column:", [row[0] for row in cur3])
except Exception as e:
    print("Error checking priority:", e)
conn.close()
