"""
Global error handlers.

Register all handlers via ``register_error_handlers(app)`` inside the
application factory.  Every expected failure surface returns the standard
error envelope:

    {"error": {"code": "...", "message": "...", "details": ...}}

Unexpected exceptions are logged with their full traceback and returned as a
generic 500 so that internal details are never exposed to clients.
"""

import logging

from flask import Flask, jsonify
from marshmallow import ValidationError
from werkzeug.exceptions import HTTPException

from app.common.exceptions import AppException
from app.extensions import db

logger = logging.getLogger(__name__)


def register_error_handlers(app: Flask) -> None:
    """Attach all global error handlers to *app*."""

    @app.errorhandler(AppException)
    def handle_app_exception(err: AppException):
        logger.error(
            "Application error",
            extra={
                "error_type": type(err).__name__,
                "error_code": err.error_code,
                "status_code": err.status_code,
            },
        )
        return (
            jsonify(
                {
                    "error": {
                        "code": err.error_code,
                        "message": err.message,
                        "details": err.details,
                    }
                }
            ),
            err.status_code,
        )

    @app.errorhandler(ValidationError)
    def handle_validation_error(err: ValidationError):
        return (
            jsonify(
                {
                    "error": {
                        "code": "VALIDATION_ERROR",
                        "message": "The request contains invalid data",
                        "details": err.messages,
                    }
                }
            ),
            400,
        )

    @app.errorhandler(HTTPException)
    def handle_http_exception(err: HTTPException):
        return (
            jsonify(
                {
                    "error": {
                        "code": "HTTP_ERROR",
                        "message": err.description,
                        "details": None,
                    }
                }
            ),
            err.code,
        )

    @app.errorhandler(Exception)
    def handle_unexpected_exception(err: Exception):
        # Roll back any open transaction so the session stays usable.
        db.session.rollback()
        logger.exception("Unhandled application exception")
        return (
            jsonify(
                {
                    "error": {
                        "code": "INTERNAL_ERROR",
                        "message": "An unexpected server error occurred",
                        "details": None,
                    }
                }
            ),
            500,
        )
