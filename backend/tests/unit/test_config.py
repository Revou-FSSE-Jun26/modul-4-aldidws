"""Unit tests for environment-driven configuration (no database needed)."""

import pytest

from app import create_app
from app.config import get_config_object, normalize_database_url, parse_origins

PROD_ENV = {
    "SECRET_KEY": "dummy-secret-key-value",
    "JWT_SECRET_KEY": "dummy-jwt-secret-value",
    "DATABASE_URL": "postgres://dbuser:dbpass-dummy@db.example.internal:5432/app",
    "CORS_ALLOWED_ORIGINS": "https://app.example.com",
}


@pytest.fixture()
def clean_env(monkeypatch):
    for name in ("APP_ENV", "FLASK_ENV", *PROD_ENV):
        monkeypatch.delenv(name, raising=False)
    return monkeypatch


@pytest.fixture()
def prod_env(clean_env):
    for name, value in PROD_ENV.items():
        clean_env.setenv(name, value)
    return clean_env


# --- environment selection -------------------------------------------------

def test_default_environment_is_production(clean_env):
    assert get_config_object() == "app.config.ProductionConfig"


def test_blank_environment_is_production(clean_env):
    clean_env.setenv("APP_ENV", "  ")
    assert get_config_object() == "app.config.ProductionConfig"


def test_app_env_selects_development(clean_env):
    clean_env.setenv("APP_ENV", "development")
    assert get_config_object() == "app.config.DevelopmentConfig"


def test_app_env_takes_precedence_over_flask_env(clean_env):
    clean_env.setenv("APP_ENV", "production")
    clean_env.setenv("FLASK_ENV", "development")
    assert get_config_object() == "app.config.ProductionConfig"


def test_flask_env_is_used_when_app_env_is_unset(clean_env):
    clean_env.setenv("FLASK_ENV", "Development")
    assert get_config_object() == "app.config.DevelopmentConfig"


def test_unknown_environment_fails_closed(clean_env):
    clean_env.setenv("APP_ENV", "staging-ish")
    with pytest.raises(RuntimeError, match="Unknown APP_ENV"):
        get_config_object()


# --- production startup ----------------------------------------------------

def test_production_app_has_debug_off(prod_env):
    app = create_app()
    assert app.config["DEBUG"] is False
    assert app.config["TESTING"] is False
    assert app.debug is False


def test_production_normalises_database_url(prod_env):
    app = create_app()
    assert app.config["SQLALCHEMY_DATABASE_URI"].startswith("postgresql://dbuser:")


@pytest.mark.parametrize("missing", list(PROD_ENV))
def test_production_refuses_to_start_without_required_variable(prod_env, missing):
    prod_env.delenv(missing)
    with pytest.raises(RuntimeError) as exc:
        create_app()
    message = str(exc.value)
    assert missing in message
    for other, value in PROD_ENV.items():
        assert value not in message


@pytest.mark.parametrize("blank", list(PROD_ENV))
def test_production_refuses_blank_variable(prod_env, blank):
    prod_env.setenv(blank, "   ")
    with pytest.raises(RuntimeError, match=blank):
        create_app()


@pytest.mark.parametrize("origins", ["*", "https://*.example.com", "app.example.com", " , "])
def test_production_rejects_unsafe_cors_origins(prod_env, origins):
    prod_env.setenv("CORS_ALLOWED_ORIGINS", origins)
    with pytest.raises(RuntimeError):
        create_app()


# --- helpers ---------------------------------------------------------------

def test_normalize_rewrites_postgres_scheme():
    assert normalize_database_url("postgres://u:p@h:5432/d") == "postgresql://u:p@h:5432/d"


def test_normalize_keeps_postgresql_scheme():
    url = "postgresql://u:p@h:5432/d"
    assert normalize_database_url(url) == url


def test_normalize_keeps_driver_suffix():
    url = "postgresql+psycopg://u:p@h:5432/d"
    assert normalize_database_url(url) == url


def test_normalize_preserves_sslmode_query():
    result = normalize_database_url("postgres://u:p@h:5432/d?sslmode=require")
    assert result == "postgresql://u:p@h:5432/d?sslmode=require"


def test_parse_origins_trims_and_drops_empty_items():
    raw = " https://a.example.com/ , ,http://localhost:3000,"
    assert parse_origins(raw) == ["https://a.example.com", "http://localhost:3000"]
