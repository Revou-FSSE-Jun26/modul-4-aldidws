"""
Application configuration classes.

Each class defines a configuration profile for a specific environment.
Load via the dotted-path string in ``create_app(config_object=...)``.
"""

import os


class _BaseConfig:
    """Shared defaults for all environments."""

    SQLALCHEMY_TRACK_MODIFICATIONS = False
    WTF_CSRF_ENABLED = False


class DevelopmentConfig(_BaseConfig):
    """Local development configuration.

    Reads DATABASE_URL and JWT_SECRET_KEY from environment / .env.
    """

    DEBUG = True
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "DATABASE_URL",
        "postgresql://localhost/revotask_dev",
    )
    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "dev-secret-change-me")


class TestingConfig(_BaseConfig):
    """Isolated test configuration used by conftest.py."""

    TESTING = True
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "TEST_DATABASE_URL",
        "postgresql://localhost/test_modulai",
    )
    JWT_SECRET_KEY = "test-secret-key-for-tests-only"


class ProductionConfig(_BaseConfig):
    """Production configuration.

    All secrets MUST be supplied through environment variables.
    Missing required values raise RuntimeError at startup.
    """

    DEBUG = False
    SQLALCHEMY_DATABASE_URI = os.environ.get("DATABASE_URL", "")
    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "")

    @classmethod
    def _validate(cls):
        if not cls.SQLALCHEMY_DATABASE_URI:
            raise RuntimeError("DATABASE_URL environment variable is required in production")
        if not cls.JWT_SECRET_KEY:
            raise RuntimeError("JWT_SECRET_KEY environment variable is required in production")
