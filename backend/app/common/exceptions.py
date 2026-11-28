"""
Application exception hierarchy.

All expected application-level failures MUST subclass AppException so that
the global error handler can format them into a consistent API response.

Raise typed subclasses from service functions; never build ad-hoc error
responses in route handlers.
"""


class AppException(Exception):
    """Base class for all expected application errors.

    Subclasses MUST override ``status_code``, ``error_code``, and ``message``
    to describe their specific failure mode.

    Args:
        message: Optional human-readable override for the default message.
            MUST be safe to return to clients — no stack traces or internals.
        details: Optional structured detail payload (e.g. field-level
            validation errors). MUST be safe to return to clients.
    """

    status_code: int = 500
    error_code: str = "INTERNAL_ERROR"
    message: str = "Internal server error"

    def __init__(self, message: str | None = None, details=None) -> None:
        self.message = message or self.__class__.message
        self.details = details
        super().__init__(self.message)


# ---------------------------------------------------------------------------
# 4xx — Client errors
# ---------------------------------------------------------------------------


class ValidationException(AppException):
    """Raised when incoming data fails business-rule validation in a service.

    Schema-layer (Marshmallow) validation errors are handled separately by the
    ``marshmallow.ValidationError`` handler and do not need to go through this
    class.
    """

    status_code = 400
    error_code = "VALIDATION_ERROR"
    message = "The request contains invalid data"


class InvalidCredentialsError(AppException):
    """Raised when authentication credentials are missing or incorrect."""

    status_code = 401
    error_code = "INVALID_CREDENTIALS"
    message = "Invalid email or password"


class MissingRefreshTokenError(AppException):
    """Raised when no refresh token cookie is present on a refresh request."""

    status_code = 401
    error_code = "MISSING_REFRESH_TOKEN"
    message = "No refresh token"


class InvalidRefreshTokenError(AppException):
    """Raised when the refresh token is invalid, revoked, or expired."""

    status_code = 401
    error_code = "INVALID_REFRESH_TOKEN"
    message = "Refresh token is invalid or expired"


class UnauthorizedError(AppException):
    """Raised when a valid token is absent or cannot be verified."""

    status_code = 401
    error_code = "UNAUTHORIZED"
    message = "Authentication is required"


class ForbiddenError(AppException):
    """Raised when an authenticated user lacks permission for an operation."""

    status_code = 403
    error_code = "FORBIDDEN"
    message = "You do not have permission to perform this action"


class CardNotFoundException(AppException):
    """Raised when a requested card does not exist."""

    status_code = 404
    error_code = "CARD_NOT_FOUND"
    message = "Card not found"


class BoardNotFoundException(AppException):
    """Raised when a requested board does not exist."""

    status_code = 404
    error_code = "BOARD_NOT_FOUND"
    message = "Board not found"


class ColumnNotFoundException(AppException):
    """Raised when a requested column does not exist."""

    status_code = 404
    error_code = "COLUMN_NOT_FOUND"
    message = "Column not found"


class LabelNotFoundException(AppException):
    """Raised when a requested label does not exist or is not accessible."""

    status_code = 404
    error_code = "LABEL_NOT_FOUND"
    message = "Label not found"


class UserNotFoundException(AppException):
    """Raised when a referenced user account does not exist."""

    status_code = 404
    error_code = "USER_NOT_FOUND"
    message = "User not found"


class ResourceConflictException(AppException):
    """Raised when an operation conflicts with existing data or state."""

    status_code = 409
    error_code = "RESOURCE_CONFLICT"
    message = "The requested operation conflicts with existing data"


# ---------------------------------------------------------------------------
# Authorization helpers — raised when ownership checks fail
# ---------------------------------------------------------------------------


class UnauthorizedBoardAccessError(AppException):
    """Raised when a user tries to access a board they do not own or belong to."""

    status_code = 403
    error_code = "BOARD_ACCESS_DENIED"
    message = "You do not have access to this board"


class CommentNotFoundException(AppException):
    """Raised when a requested comment does not exist."""

    status_code = 404
    error_code = "COMMENT_NOT_FOUND"
    message = "Comment not found"


class UnauthorizedCommentAccessError(AppException):
    """Raised when a user tries to edit or delete a comment they do not own."""

    status_code = 403
    error_code = "COMMENT_ACCESS_DENIED"
    message = "You do not have permission to modify this comment"


class NotificationNotFoundException(AppException):
    """Raised when a requested notification does not exist or is not owned by the user."""

    status_code = 404
    error_code = "NOTIFICATION_NOT_FOUND"
    message = "Notification not found"
