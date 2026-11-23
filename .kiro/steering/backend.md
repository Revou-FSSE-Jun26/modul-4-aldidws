---
inclusion: fileMatch
fileMatchPattern: "{app,tests,migrations}/**/*.py"
---

# Backend Engineering Standards (Flask)

## 1. Engineering Principles

All backend implementation MUST follow these principles:

1. **Separation of Concerns:** Separate HTTP handling, business logic, data access, validation, and serialization.
2. **Single Responsibility:** Every module and function MUST have one clear responsibility.
3. **Security First:** Never trust client-provided identity, ownership, permissions, or resource relationships.
4. **Data Integrity:** Enforce business rules and database constraints at the appropriate layers.
5. **Explicit Contracts:** API endpoints MUST have predictable request, response, and error formats.
6. **Testability:** Business logic MUST be testable independently of Flask request handling.
7. **Consistency:** Reuse existing project patterns instead of introducing unnecessary abstractions.
8. **Maintainability:** Prefer readable, explicit code over clever implementations or unnecessary complexity.

Do not introduce architectural complexity without a measurable requirement.

## 2. Backend Architecture

Use a modular Flask application organized around business features.

### Recommended Structure

```text
app/
├── __init__.py
├── config.py
├── extensions.py
│
├── models/
│   ├── __init__.py
│   ├── user.py
│   ├── board.py
│   ├── column.py
│   ├── card.py
│   └── comment.py
│
├── blueprints/
│   ├── auth/
│   │   ├── __init__.py
│   │   ├── routes.py
│   │   ├── service.py
│   │   └── schemas.py
│   ├── boards/
│   │   ├── __init__.py
│   │   ├── routes.py
│   │   ├── service.py
│   │   └── schemas.py
│   ├── cards/
│   │   ├── __init__.py
│   │   ├── routes.py
│   │   ├── service.py
│   │   └── schemas.py
│   └── comments/
│       ├── __init__.py
│       ├── routes.py
│       ├── service.py
│       └── schemas.py
│
├── common/
│   ├── exceptions.py
│   ├── error_handlers.py
│   ├── responses.py
│   ├── permissions.py
│   └── logging.py
│
└── utils/
    └── ...

migrations/
tests/
├── conftest.py
├── unit/
├── integration/
└── api/
```

### Architecture Rules

- Organize modules by business feature.
- Keep shared infrastructure in `common/` and `extensions.py`.
- Keep SQLAlchemy models in `models/`.
- Keep feature-specific routes, services, and schemas inside their respective blueprints.
- Keep application configuration separate from business logic.
- Do not create empty modules or unnecessary abstraction layers.
- Follow the existing project structure when it is already established.
- Do not move or rename existing modules without a clear technical reason.

### Layer Responsibilities

| Layer | Responsibility |
|---|---|
| Routes | HTTP request handling and response generation |
| Schemas | Request validation and response serialization |
| Services | Business rules, authorization, and use-case orchestration |
| Models | Database entities, relationships, and persistence mapping |
| Common | Shared exceptions, permissions, responses, and infrastructure |
| Tests | Verification of business logic, API behavior, and data integrity |

## 3. Route Handler Standards

### Shared Route-Handler Rule

**RULE:**

- Every route handler MUST remain thin and focused on HTTP responsibilities.
- Routes MUST validate incoming data using the appropriate Marshmallow schema.
- Routes MUST delegate business operations to functions in the corresponding `service.py`.
- Routes MUST return consistent API responses with appropriate HTTP status codes.
- Routes MUST NOT contain business logic or direct SQLAlchemy queries.
- Routes MUST NOT manage database transactions.
- Routes MUST NOT implement ad-hoc error response formatting.
- Routes MUST NOT contain unnecessary `try/except` blocks for errors handled centrally.
- Do not enforce an arbitrary five-line limit. Prioritize readability and separation of concerns.

**RATIONALE:**

Thin HTTP handlers decouple Flask request handling from business logic, allowing services to be tested directly using ordinary Python.

### Example

```python
@cards_bp.route("/<int:card_id>/position", methods=["PATCH"])
@token_required
def reorder_card(current_user, card_id):
    payload = ReorderCardSchema().load(request.get_json())
    card = move_card(current_user, card_id, payload["position"])
    return jsonify({"data": card.to_dict()}), 200
```

### Allowed Route Responsibilities

- Read request bodies, path parameters, and query parameters.
- Validate incoming data.
- Receive the authenticated user from authentication middleware.
- Call the appropriate service function.
- Serialize the response.
- Return the correct HTTP status code.

### Prohibited Route Responsibilities

- Business rule implementation.
- Direct database queries or mutations.
- Database transaction management.
- Resource ownership and permission logic duplicated across endpoints.
- Custom exception formatting.
- Returning raw SQLAlchemy models.
- Exposing internal database or application details.

## 4. Service Layer Standards

The service layer MUST contain application use cases and business rules.

### Rules

- Each service function MUST represent a meaningful business operation.
- Services MUST remain independent of Flask request and response objects.
- Services MUST enforce business validation and resource authorization.
- Services MUST coordinate database operations.
- Services MUST use descriptive function names.
- Services SHOULD return domain objects or well-defined Python data structures.
- Services MUST raise appropriate application exceptions when operations fail.
- Shared business rules MUST NOT be duplicated across different services.
- Avoid unnecessary coupling between unrelated feature services.

### Example

```python
def move_card(current_user, card_id, new_position):
    card = get_card_or_raise(card_id)

    ensure_board_access(current_user, card.board_id)
    validate_card_position(new_position)

    card.position = new_position
    db.session.commit()

    return card
```

This example illustrates the responsibility boundary. Use the project's established transaction and query patterns when implementing actual features.

### Service Design Rules

- Do not import Flask's `request`, `jsonify`, or response objects into services.
- Do not return HTTP response tuples from services.
- Do not convert every exception into a generic application exception.
- Preserve the original exception when propagating unexpected failures.
- Keep helper functions focused and reusable.
- Avoid excessive service-to-service dependencies.

## 5. Request Validation and Marshmallow

Use Marshmallow for validating client-controlled input and serializing API data where appropriate.

### Rules

- Every endpoint accepting client-controlled data MUST validate that data.
- Define explicit schemas for create, update, and other specialized operations.
- Validate required fields, types, lengths, ranges, formats, and allowed values.
- Use `partial=True` or equivalent PATCH-specific validation where appropriate.
- Reject invalid values before business operations execute.
- Never rely exclusively on frontend validation.
- Do not expose internal database fields through response serialization.
- Avoid using one overly permissive schema for unrelated operations.
- Keep validation rules consistent with the application's requirements.

### Example

```python
class CreateCardSchema(Schema):
    title = fields.String(
        required=True,
        validate=validate.Length(min=1, max=255)
    )

    description = fields.String(
        load_default="",
        validate=validate.Length(max=2000)
    )

    priority = fields.String(
        load_default="Medium",
        validate=validate.OneOf(["Low", "Medium", "High"])
    )
```

### Validation Boundaries

- **Schema validation:** Data types, required fields, formats, lengths, and allowed values.
- **Service validation:** Business rules, resource state, ownership, and operation constraints.
- **Database constraints:** Uniqueness, foreign keys, nullability, and other persistent integrity requirements.

Do not duplicate complex business rules in schemas and services.

## 6. Custom Exception Hierarchy

All expected application-level failures MUST use typed subclasses of `AppException`.

Create the shared exception hierarchy in:

`app/common/exceptions.py`

### Rules

- Every application exception MUST define an appropriate `status_code`, `error_code`, and default `message`.
- Services MUST raise typed application exceptions for expected business failures.
- Route handlers MUST NOT return ad-hoc error responses.
- Exception messages returned to clients MUST be safe and must not expose internal implementation details.
- Validation details MAY be included when they are safe to disclose.
- Do not use exceptions as a substitute for normal conditional logic.
- Do not catch and suppress exceptions without a clear recovery strategy.

### Example

```python
class AppException(Exception):
    status_code = 500
    error_code = "INTERNAL_ERROR"
    message = "Internal server error"

    def __init__(self, message=None, details=None):
        self.message = message or self.message
        self.details = details
        super().__init__(self.message)


class CardNotFoundException(AppException):
    status_code = 404
    error_code = "CARD_NOT_FOUND"
    message = "Card not found"


class UnauthorizedBoardAccessError(AppException):
    status_code = 403
    error_code = "BOARD_ACCESS_DENIED"
    message = "No access to this board"


class InvalidCredentialsError(AppException):
    status_code = 401
    error_code = "INVALID_CREDENTIALS"
    message = "Invalid email or password"


class ResourceConflictException(AppException):
    status_code = 409
    error_code = "RESOURCE_CONFLICT"
    message = "The requested operation conflicts with existing data"
```

Add feature-specific exception subclasses when they represent meaningful application errors.

Do not create a separate exception class for every minor validation message.

## 7. Global Error Handling

Register centralized error handlers during application initialization.

Implementation location:

`app/common/error_handlers.py`

Registration MUST happen through the Flask application factory or the project's established initialization mechanism.

### Required Handlers

1. `AppException`: Expected application errors.
2. `marshmallow.ValidationError`: Request validation errors.
3. `werkzeug.exceptions.HTTPException`: Standard HTTP errors.
4. `Exception`: Unexpected application errors.

### Rules

- All API errors MUST use the standard error response format.
- Known application exceptions MUST preserve their intended HTTP status codes.
- Validation errors MUST return safe field-level details.
- HTTP exceptions MUST preserve their appropriate status codes.
- Unexpected exceptions MUST return a generic 500 response.
- Internal stack traces MUST NEVER be returned to clients.
- Unexpected exceptions MUST be logged with their traceback internally.
- Database sessions MUST be cleaned up or rolled back when necessary.
- Do not register duplicate handlers for the same exception without a clear reason.

### Example

```python
def register_error_handlers(app):

    @app.errorhandler(AppException)
    def handle_app_exception(err):
        log_error(err, err.status_code)
        return jsonify({
            "error": {
                "code": err.error_code,
                "message": err.message,
                "details": err.details
            }
        }), err.status_code

    @app.errorhandler(ValidationError)
    def handle_validation_error(err):
        return jsonify({
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "The request contains invalid data",
                "details": err.messages
            }
        }), 400

    @app.errorhandler(HTTPException)
    def handle_http_exception(err):
        return jsonify({
            "error": {
                "code": "HTTP_ERROR",
                "message": err.description,
                "details": None
            }
        }), err.code

    @app.errorhandler(Exception)
    def handle_unexpected_exception(err):
        app.logger.exception("Unhandled application exception")
        return jsonify({
            "error": {
                "code": "INTERNAL_ERROR",
                "message": "An unexpected server error occurred",
                "details": None
            }
        }), 500
```

The example illustrates the required behavior. Adapt logging, request context, and database cleanup to the project's configured infrastructure.

Do not expose `str(err)` for unexpected exceptions.

## 8. API Response Standards

All API endpoints MUST follow a consistent JSON response contract.

### Successful Single Resource Response

```json
{
  "data": {
    "id": 1,
    "title": "Implement authentication"
  }
}
```

### Successful Collection Response

```json
{
  "data": [
    {
      "id": 1,
      "title": "Implement authentication"
    }
  ],
  "meta": {
    "page": 1,
    "per_page": 20,
    "total": 1
  }
}
```

### Standard Error Response

```json
{
  "error": {
    "code": "CARD_NOT_FOUND",
    "message": "Card not found",
    "details": null
  }
}
```

### Validation Error Response

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request contains invalid data",
    "details": {
      "title": [
        "Missing data for required field."
      ]
    }
  }
}
```

### Rules

- Use `data` for successful response payloads.
- Use `meta` for pagination and collection metadata.
- Use `error` for failed responses.
- Use stable machine-readable error codes.
- Keep error messages understandable and safe.
- Do not expose stack traces, SQL statements, database credentials, or internal file paths.
- Do not mix response formats between blueprints.
- Use a consistent response serializer for each resource.
- A `204 No Content` response MUST NOT contain a response body.

### HTTP Status Codes

| Status | Meaning |
|---|---|
| 200 | Successful read or update |
| 201 | Resource created successfully |
| 204 | Successful operation with no response body |
| 400 | Invalid request or validation failure |
| 401 | Missing or invalid authentication |
| 403 | Authenticated user lacks permission |
| 404 | Resource not found |
| 409 | Resource or state conflict |
| 422 | Semantically invalid input, if consistently adopted |
| 500 | Unexpected server error |

Use one consistent validation status convention across the application. Do not alternate between 400 and 422 without a documented reason.

## 9. Structured Logging and Observability

Use structured JSON logging for production diagnostics.

### Required Error Log Fields

- `timestamp`: UTC timestamp in ISO 8601 format.
- `level`: Log severity.
- `request_id`: Unique request correlation identifier when available.
- `method`: HTTP method.
- `endpoint`: Request path or matched endpoint.
- `status_code`: Resulting HTTP status.
- `error_type`: Exception class name.
- `user_id`: Authenticated user identifier when available.

Additional fields MAY include:

- `error_code`
- `duration_ms`
- `service_name`
- `exception_message` for safe internal diagnostics.

### Example

```json
{
  "timestamp": "2026-11-19T10:30:00+00:00",
  "level": "ERROR",
  "request_id": "req-123",
  "method": "PATCH",
  "endpoint": "/api/cards/7/position",
  "status_code": 404,
  "error_type": "CardNotFoundException",
  "error_code": "CARD_NOT_FOUND",
  "user_id": 12
}
```

### Logging Rules

- Use Python's standard `logging` module or the project's existing structured logging solution.
- Emit machine-readable JSON in production.
- Use `logger.exception()` for unexpected exceptions that require traceback diagnostics.
- Use appropriate log levels:
  - `DEBUG`: Development diagnostics.
  - `INFO`: Significant application events.
  - `WARNING`: Recoverable or suspicious conditions.
  - `ERROR`: Failed operations and application errors.
  - `CRITICAL`: Severe failures requiring immediate attention.
- Do not log passwords, tokens, authorization headers, secrets, or sensitive personal information.
- Avoid logging complete request bodies by default.
- Do not expose internal diagnostic information through API responses.
- Avoid logging the same exception repeatedly at multiple layers without a reason.

### Request Correlation

- Generate or accept a validated request ID at the request boundary.
- Include it in logs and error responses when appropriate.
- Use the request ID to correlate related log entries.
- Do not trust arbitrary client-provided correlation identifiers without validation.

## 10. Authentication and Authorization

Authentication and authorization MUST be enforced by the backend.

### Authentication Rules

- Protect private endpoints using the project's authentication mechanism.
- Validate token signatures, expiration, and required claims.
- Reject missing, malformed, expired, or invalid credentials.
- Never trust a user ID supplied in a request body as the authenticated identity.
- Store password hashes, never plaintext passwords.
- Use a secure password hashing algorithm such as Argon2id or bcrypt.
- Never expose passwords, password hashes, or authentication secrets.
- Apply consistent authentication behavior across protected endpoints.

### Authorization Rules

- Verify resource ownership or membership before accessing protected resources.
- Enforce authorization for read, create, update, delete, and reorder operations.
- A user MUST NOT access another user's private boards, columns, cards, or comments without explicit permission.
- Validate parent-child relationships when creating or moving resources.
- Enforce role-based permissions when the application defines roles.
- Do not rely on frontend route guards or hidden UI controls for security.
- Reuse shared permission functions instead of duplicating authorization logic.

### Example

```python
def ensure_board_access(user, board_id):
    board = Board.query.filter_by(
        id=board_id,
        owner_id=user.id
    ).first()

    if board is None:
        raise NotFoundError("Board not found")

    return board
```

For shared boards or team membership, implement the appropriate membership and permission checks instead of relying exclusively on `owner_id`.

### Authorization Response Policy

- Use 401 when authentication is missing or invalid.
- Use 403 when the authenticated user is not permitted to perform an operation.
- Consider 404 for private resources when revealing their existence would expose information.
- Apply the same resource-disclosure policy consistently.

## 11. Database and SQLAlchemy Standards

Use PostgreSQL as the primary persistent database and SQLAlchemy for ORM operations.

### Model Rules

- Keep models in `app/models/`.
- Use explicit primary keys and foreign keys.
- Define relationships intentionally.
- Add uniqueness and integrity constraints where required.
- Use appropriate nullable settings.
- Avoid unnecessary relationships and redundant columns.
- Use consistent naming conventions for tables, fields, and constraints.
- Avoid putting HTTP-specific behavior inside models.

### Query Rules

- Avoid N+1 query patterns.
- Use eager loading when appropriate.
- Filter records at the database level.
- Avoid loading entire tables when only a subset is required.
- Use database indexes for frequently queried fields when justified.
- Avoid raw SQL unless ORM capabilities are insufficient or there is a measurable benefit.
- Apply ownership and authorization filters to database queries where appropriate.

### Transaction Management

- Each logical write operation MUST have a clearly defined transaction boundary.
- Operations modifying multiple related records MUST be atomic.
- Commit only when the complete operation succeeds.
- Roll back failed transactions before propagating errors.
- Avoid committing independently inside helper functions participating in one logical transaction.
- Use `flush()` when generated database identifiers are needed before commit.
- Do not suppress database exceptions.
- Do not expose database exception details to clients.

### Example

```python
try:
    db.session.add(card)
    db.session.flush()

    create_activity_log(current_user.id, card.id)

    db.session.commit()
except Exception:
    db.session.rollback()
    raise
```

Use explicit transaction handling appropriate to the operation. Avoid adding redundant nested transaction management.

### Database Integrity

Enforce critical rules at both appropriate application and database boundaries.

Examples:

- Unique user email.
- Required task or card title.
- Valid foreign-key relationships.
- Valid ownership relationships.
- Non-null required fields.
- Valid resource relationships.

Application validation improves usability; database constraints protect persistent integrity.

## 12. Database Migrations

Use Flask-Migrate and Alembic for schema versioning.

### Rules

- Every database schema change MUST include a migration.
- Review generated migrations before applying them.
- Never use production `create_all()` as a replacement for migrations.
- Do not modify production database structures manually as the normal deployment process.
- Consider existing data before changing nullability, constraints, or relationships.
- Test migrations against a representative database state.
- Keep migrations committed to version control.
- Avoid destructive migrations without a reviewed data migration or recovery plan.

## 13. API Design Standards

Use RESTful resource-oriented API conventions.

### Rules

- Use plural resource names: `/boards`, `/columns`, `/cards`, `/comments`.
- Use HTTP methods according to their intended semantics:
  - `GET`: Retrieve resources.
  - `POST`: Create resources or execute explicitly defined actions.
  - `PUT`: Replace a resource when full replacement semantics are intended.
  - `PATCH`: Partially update a resource.
  - `DELETE`: Delete a resource.
- Use path parameters for resource identifiers.
- Use query parameters for filtering, sorting, and pagination.
- Avoid exposing internal database implementation details.
- Keep request and response contracts consistent.
- Document non-obvious endpoint behavior and business constraints.
- Avoid unnecessary endpoint duplication.

## 14. Pagination, Filtering, and Sorting

Collection endpoints MUST support appropriate pagination when data can grow over time.

### Rules

- Define a reasonable default page size.
- Enforce a maximum page size.
- Validate pagination parameters.
- Validate supported filter fields and values.
- Allow only explicitly supported sorting fields and directions.
- Perform filtering and sorting at the database level.
- Apply authorization filters before returning collection results.
- Use deterministic sorting with a stable secondary key.
- Return pagination metadata consistently.
- Avoid returning unbounded collections by default.

## 15. Security Standards

Security MUST be enforced at the backend boundary.

### Input and Output Security

- Validate and normalize untrusted input where appropriate.
- Never build SQL queries through unsafe string concatenation.
- Do not trust client-provided roles, permissions, prices, ownership, or identity.
- Avoid unsafe deserialization.
- Never expose sensitive model fields through API serialization.
- Sanitize data before rendering or using it in contexts that require sanitization.

### Secrets and Configuration

- Load secrets from environment variables or an approved secret manager.
- Never commit production credentials or real `.env` files.
- Keep public frontend configuration separate from backend secrets.
- Use separate configurations for development, testing, and production.
- Fail fast when required production secrets are missing.
- Never hardcode JWT secrets, API keys, database URLs, or credentials.

### HTTP Security

- Configure CORS with explicit allowed origins.
- Do not use unrestricted origins with credentialed requests.
- Define a CSRF protection strategy when browser authentication uses cookies.
- Use HTTPS in production.
- Configure secure cookie attributes when cookies are used: `Secure`, `HttpOnly`, and an appropriate `SameSite` policy.
- Apply appropriate request-size limits.
- Avoid exposing unnecessary server or framework version information.

### Authentication Transport

- Keep token transport consistent with the frontend authentication architecture.
- Prefer secure HttpOnly cookies for browser-based session or token authentication when compatible with the application.
- Do not store sensitive authentication tokens in `localStorage` or `sessionStorage`.
- If using cookie-based authentication, implement the required CSRF protections.
- Do not assume that JWT usage alone makes an authentication system secure.

## 16. Performance and Reliability

- Optimize based on actual access patterns and measured bottlenecks.
- Avoid unnecessary database queries.
- Use indexes when justified by query patterns.
- Configure database connection pooling and timeouts appropriately.
- Set timeouts for external service calls.
- Avoid expensive synchronous operations inside request processing.
- Use background jobs only when genuinely required.
- Make retryable operations safe against unintended duplicate effects.
- Use caching only with a defined invalidation and consistency strategy.
- Avoid premature optimization and unnecessary infrastructure.

## 17. Testing Standards

Use Pytest for backend testing.

Tests MUST verify both expected behavior and important failure conditions.

### Unit Tests

Test service functions independently of Flask request handling.

Cover:

- Successful operations.
- Business validation failures.
- Resource not found.
- Authorization failures.
- State conflicts.
- Invalid operation sequences.
- Transaction-related behavior where relevant.

### Integration Tests

Test database and application interactions.

Cover:

- Model relationships.
- Foreign-key constraints.
- Uniqueness constraints.
- Database transaction rollback.
- Resource ownership.
- Related-record creation and deletion.
- Migration behavior when relevant.

### API Tests

Test endpoint behavior using Flask's test client.

Cover:

- HTTP status codes.
- Request validation.
- Response JSON contracts.
- Missing authentication.
- Invalid and expired tokens.
- Unauthorized resource access.
- Pagination, filtering, and sorting.
- Standard error responses.
- Unexpected exception handling.

### Security Tests

At minimum, verify:

- User A cannot access User B's private resources.
- User A cannot update or delete User B's resources by changing resource IDs.
- A user cannot move a card into a board or column they cannot access.
- Client-provided ownership and role fields cannot override server-side identity.
- Sensitive information is never returned in API responses.

### Test Isolation

- Use an isolated test database.
- Never run automated tests against production data.
- Use fixtures for reusable setup.
- Avoid shared mutable state between tests.
- Ensure tests have predictable setup and cleanup.
- Do not claim tests pass unless they have actually been executed.

## 18. Dependency Management

- Prefer established and actively maintained libraries.
- Do not add a dependency for functionality already supported by the existing stack.
- Evaluate security, maintenance status, compatibility, and licensing before adding dependencies.
- Pin or constrain dependency versions using the project's dependency-management convention.
- Remove unused dependencies.
- Do not upgrade unrelated dependencies as part of a small feature change without justification.

## 19. API Documentation

- Document endpoint methods and paths.
- Document authentication requirements.
- Document request parameters and schemas.
- Document success and error response structures.
- Document status codes and relevant business constraints.
- Keep API documentation synchronized with implementation.
- Use OpenAPI documentation when the project benefits from a formal API contract.
- Avoid comments that merely restate obvious code behavior.

## 20. AI Coding Agent Instructions

AI coding agents MUST follow these rules when modifying backend code.

### Before Implementation

1. Inspect the existing project structure.
2. Identify the relevant blueprint, route, service, schema, model, and tests.
3. Read existing implementations before creating new patterns.
4. Identify affected database relationships and constraints.
5. Confirm the authentication and authorization approach.
6. Understand the expected API contract.
7. Identify possible backward-compatibility issues.

### During Implementation

- Follow the existing architecture and naming conventions.
- Reuse existing services, schemas, exceptions, and permission helpers.
- Do not duplicate existing business rules.
- Do not introduce unnecessary dependencies.
- Do not modify unrelated modules.
- Preserve existing API contracts unless explicitly required to change them.
- Consider authorization and data integrity for every resource operation.
- Add or update tests for changed behavior.
- Include migrations for database schema changes.
- Do not introduce speculative features outside the requested scope.

### After Implementation

- Run relevant backend tests.
- Run linting and formatting checks when configured.
- Verify type and schema consistency where applicable.
- Review database migrations when schema changes are made.
- Verify authorization boundaries.
- Verify API response contracts.
- Report:
  - Summary of changes.
  - Files created or modified.
  - Important implementation decisions.
  - Tests and checks actually executed.
  - Known limitations or unresolved issues.

Never claim that tests, builds, migrations, or deployments succeeded unless they were actually executed and verified.

## 21. Definition of Done

A backend feature is complete only when:

- [ ] Routes follow the thin-handler principle.
- [ ] Request data is validated through appropriate schemas.
- [ ] Business logic is implemented in the service layer.
- [ ] Custom exceptions are used for expected application failures.
- [ ] Global error handlers format API errors consistently.
- [ ] Structured logs provide useful diagnostic context.
- [ ] Database operations preserve transaction integrity.
- [ ] Authentication and authorization are enforced.
- [ ] Resource ownership is verified.
- [ ] API responses follow the established contract.
- [ ] Sensitive information is not exposed.
- [ ] Relevant tests are implemented and pass.
- [ ] Database migrations are included when required.
- [ ] Documentation is updated when API behavior changes.
- [ ] No unrelated behavior has been unintentionally modified.

## 22. Engineering Decision Priority

When engineering decisions conflict, follow this priority:

1. Security and data integrity.
2. Correctness and business-rule enforcement.
3. API consistency and backward compatibility.
4. Reliability and error handling.
5. Maintainability and readability.
6. Testability and observability.
7. Performance and scalability.
8. Developer convenience and stylistic preferences.

Never sacrifice security, correctness, or maintainability to satisfy arbitrary code-size restrictions or unnecessary abstractions.