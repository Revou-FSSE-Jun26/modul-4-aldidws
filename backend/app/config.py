"""
Application configuration classes.

Each class defines a configuration profile for a specific environment.
``get_config_object()`` picks the profile from ``APP_ENV`` (or ``FLASK_ENV``)
and defaults to production when neither is set.

``ProductionConfig`` has no defaults. It reads the environment in
``init_app`` and raises ``RuntimeError`` if a required variable is missing.
"""

import os

_CONFIG_PATHS = {
    "production": "app.config.ProductionConfig",
    "development": "app.config.DevelopmentConfig",
    "testing": "app.config.TestingConfig",
}


def normalize_database_url(url: str) -> str:
    """Return *url* with a ``postgres://`` scheme rewritten to ``postgresql://``.

    SQLAlchemy 2.x does not accept the ``postgres`` dialect name that some
    platforms (including Railway) hand out. Other schemes and any query string
    (for example ``?sslmode=require``) are left untouched.
    """
    if url.startswith("postgres://"):
        return "postgresql://" + url[len("postgres://"):]
    return url


def parse_origins(raw: str) -> list[str]:
    """Split a comma-separated origin list, trimming spaces and trailing slashes."""
    origins = []
    for item in raw.split(","):
        item = item.strip().rstrip("/")
        if item:
            origins.append(item)
    return origins


def get_config_object() -> str:
    """Return the dotted path of the config class for the current environment."""
    name = (os.environ.get("APP_ENV") or os.environ.get("FLASK_ENV") or "").strip().lower()
    if not name:
        name = "production"
    try:
        return _CONFIG_PATHS[name]
    except KeyError:
        raise RuntimeError(
            f"Unknown APP_ENV/FLASK_ENV value {name!r}. "
            "Use production, development or testing."
        ) from None


class _BaseConfig:
    """Shared defaults for all environments."""

    SQLALCHEMY_TRACK_MODIFICATIONS = False
    WTF_CSRF_ENABLED = False


class DevelopmentConfig(_BaseConfig):
    """Local development configuration.

    Reads DATABASE_URL and JWT_SECRET_KEY from environment / .env and falls
    back to local-only placeholders. Never use these defaults outside a
    developer machine.
    """

    DEBUG = True
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-only-secret-key")
    SQLALCHEMY_DATABASE_URI = normalize_database_url(
        os.environ.get("DATABASE_URL", "postgresql://localhost/revotask_dev")
    )
    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "dev-secret-change-me")
    CORS_ALLOWED_ORIGINS = parse_origins(
        os.environ.get("CORS_ALLOWED_ORIGINS", "http://localhost:3000")
    )


class TestingConfig(_BaseConfig):
    """Isolated test configuration used by conftest.py."""

    TESTING = True
    SECRET_KEY = "test-secret-key-for-tests-only"
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "TEST_DATABASE_URL",
        "postgresql://localhost/test_modulai",
    )
    JWT_SECRET_KEY = "test-secret-key-for-tests-only"
    CORS_ALLOWED_ORIGINS: list[str] = []


class ProductionConfig(_BaseConfig):
    """Production configuration.

    All values come from environment variables, read when the app is created.
    A missing or invalid value raises RuntimeError at startup. The error
    names the variables but never prints their values.
    """

    DEBUG = False
    TESTING = False

    @classmethod
    def init_app(cls, app) -> None:
        env = {
            name: os.environ.get(name, "").strip()
            for name in ("SECRET_KEY", "JWT_SECRET_KEY", "DATABASE_URL", "CORS_ALLOWED_ORIGINS")
        }
        missing = [name for name, value in env.items() if not value]
        if missing:
            raise RuntimeError(
                "Missing required environment variable(s) in production: "
                + ", ".join(missing)
            )

        origins = parse_origins(env["CORS_ALLOWED_ORIGINS"])
        if not origins or any(
            not o.startswith(("http://", "https://")) or "*" in o for o in origins
        ):
            raise RuntimeError(
                "CORS_ALLOWED_ORIGINS must be a comma-separated list of "
                "http(s) origins. Wildcards are not allowed in production."
            )

        app.config["SECRET_KEY"] = env["SECRET_KEY"]
        app.config["JWT_SECRET_KEY"] = env["JWT_SECRET_KEY"]
        app.config["SQLALCHEMY_DATABASE_URI"] = normalize_database_url(env["DATABASE_URL"])
        app.config["CORS_ALLOWED_ORIGINS"] = origins
