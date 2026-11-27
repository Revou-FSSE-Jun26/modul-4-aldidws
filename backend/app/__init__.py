"""
Application factory.

Create and configure a Flask application instance.  Callers should use
``create_app()`` rather than importing a module-level app object, which keeps
the factory testable and avoids circular-import issues.
"""
from flasgger import Swagger
from flask import Flask
from werkzeug.utils import import_string

from app.common.error_handlers import register_error_handlers
from app.config import get_config_object
from app.extensions import cors, db


def create_app(config_object: str | None = None) -> Flask:
    """Create, configure, and return a Flask application instance.

    Args:
        config_object: Dotted-path string of the config class to load.
            Defaults to the class selected by ``APP_ENV`` / ``FLASK_ENV``
            (production when neither is set).  Pass
            ``"app.config.TestingConfig"`` in tests.

    Returns:
        A fully initialised Flask application.
    """
    app = Flask(__name__)
    config_object = config_object or get_config_object()
    app.config.from_object(config_object)
    config_cls = import_string(config_object)
    if hasattr(config_cls, "init_app"):
        config_cls.init_app(app)

    # CORS: explicit allowlist. Auth uses the Bearer header, not cookies.
    cors.init_app(
        app,
        resources={
            r"/api/*": {
                "origins": app.config.get("CORS_ALLOWED_ORIGINS", []),
                "methods": ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
                "allow_headers": ["Content-Type", "Authorization"],
                "supports_credentials": False,
                "max_age": 600,
            }
        },
    )

    # Swagger / OpenAPI configuration
    app.config["SWAGGER"] = {
        "title": "RevoTask API",
        "uiversion": 3,
        "openapi": "3.0.3",
        "description": "RevoTask Kanban board REST API. Use the Authorize button to set your Bearer token.",
        "securityDefinitions": {
            "BearerAuth": {
                "type": "apiKey",
                "name": "Authorization",
                "in": "header",
                "description": "Format: Bearer <access_token>",
            }
        },
    }
    Swagger(app)

    # Initialise extensions
    db.init_app(app)

    from flask_migrate import Migrate
    Migrate(app, db)

    # Register blueprints
    _register_blueprints(app)

    # Register global error handlers
    register_error_handlers(app)

    @app.route('/api/health', methods=['GET'])
    def health_check():
        from flask import jsonify
        try:
            db.session.execute(db.text('SELECT 1'))
            db_status = 'ok'
        except Exception:
            db_status = 'error'
        return jsonify({'data': {'status': 'ok', 'db': db_status}}), 200

    return app


def _register_blueprints(app: Flask) -> None:
    from app.blueprints.cards import cards_bp
    from app.blueprints.auth import auth_bp
    from app.blueprints.boards import boards_bp
    from app.blueprints.columns import columns_bp
    from app.blueprints.comments import comments_bp
    from app.blueprints.notifications import notifications_bp
    from app.blueprints.analytics import analytics_bp
    from app.blueprints.users import users_bp
    from app.blueprints.labels import labels_bp
    from app.blueprints.members import members_boards, members_cards

    # NOTE (technical debt): cards_bp and columns_bp are registered under
    # /api/v1/ while every other blueprint uses /api/ without a version prefix.
    # This inconsistency pre-dates the current implementation and should be
    # resolved in a dedicated API-versioning task before the first public
    # release.  Do NOT fix here — changing these URLs is a breaking change
    # for existing clients.
    app.register_blueprint(cards_bp, url_prefix="/api/v1/cards")
    app.register_blueprint(cards_bp, url_prefix="/api/v1/columns", name="cards_columns")
    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(boards_bp, url_prefix="/api/boards")
    app.register_blueprint(columns_bp, url_prefix="/api/boards", name="columns_boards")
    app.register_blueprint(columns_bp, url_prefix="/api/columns")
    app.register_blueprint(comments_bp, url_prefix="/api/cards", name="comments_cards")
    app.register_blueprint(comments_bp, url_prefix="/api/comments")
    app.register_blueprint(notifications_bp, url_prefix="/api/notifications")
    app.register_blueprint(analytics_bp, url_prefix="/api/analytics")
    app.register_blueprint(users_bp, url_prefix="/api/users")
    app.register_blueprint(labels_bp, url_prefix="/api")
    # The two members blueprints already carry their url_prefix in __init__.py.
    app.register_blueprint(members_boards)
    app.register_blueprint(members_cards)
