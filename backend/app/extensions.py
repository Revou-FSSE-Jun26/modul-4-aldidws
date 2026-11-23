"""
Flask extension instances.

Instantiated here and initialised with the app inside the application factory
(``app/__init__.py``) to avoid circular imports.
"""

from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy

db: SQLAlchemy = SQLAlchemy()
cors: CORS = CORS()
