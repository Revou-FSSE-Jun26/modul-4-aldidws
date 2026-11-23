"""WSGI entry point for production deployment (Gunicorn, Railway, etc.).

The config class is chosen from APP_ENV (or FLASK_ENV). Production is the
default, so the app refuses to start without its required variables.
"""
from app import create_app

app = create_app()

if __name__ == "__main__":
    app.run()
