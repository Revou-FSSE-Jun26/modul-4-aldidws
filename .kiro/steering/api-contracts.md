---
inclusion: fileMatch
fileMatchPattern: "{frontend/src/features,frontend/src/lib/api,backend/app/blueprints}/**/*"
---

# API Contract Standards

## 1. Purpose

This document defines the API communication standards between the Next.js frontend and Flask backend.

It establishes consistent rules for:

- REST endpoint design and HTTP methods.
- Request and response formats.
- Authentication and authorization behavior.
- Input validation and error handling.
- Pagination, filtering, and sorting.
- Data serialization and resource relationships.
- API compatibility and versioning.
- Frontend and backend integration.

The frontend and backend MUST follow the same API contracts.

Neither side may independently introduce incompatible endpoint paths, field names, response structures, or behavioral assumptions.

---

## 2. Core Principles

All API implementations MUST follow these principles:

1. **Contract First:** Define the expected request, response, and error behavior before implementing an endpoint.
2. **Consistency:** Use standardized naming, response structures, status codes, and validation rules.
3. **Explicit Contracts:** Every endpoint must have documented inputs, outputs, and authorization requirements.
4. **Backend Authority:** The backend is the source of truth for business rules, permissions, and persisted data.
5. **Predictability:** Identical operations must follow consistent response conventions.
6. **Backward Compatibility:** Existing consumers must not break when non-breaking API changes are introduced.
7. **Security:** Never trust client-supplied ownership, permissions, prices, or other security-sensitive values.
8. **Traceability:** Errors must provide enough information to diagnose failures without exposing internal implementation details.

---

## 3. API Architecture

### 3.1 Technology

| Layer | Technology |
|---|---|
| Frontend | Next.js + React + TypeScript |
| Backend | Flask + Python |
| Validation | Marshmallow |
| Database | PostgreSQL + SQLAlchemy |
| API Style | REST |
| Data Format | JSON |
| API Testing | Pytest + Playwright |

### 3.2 API Base URL

All backend endpoints MUST use a consistent API prefix.

```text
/api/v1
```

Examples:

```text
/api/v1/auth/login
/api/v1/boards
/api/v1/cards
```

The frontend MUST obtain the backend base URL from environment configuration.

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:5000/api/v1
```

Production configuration MUST use the deployed backend URL and HTTPS.

Do not hardcode environment-specific URLs in application code.

### 3.3 Communication Flow

```text
Next.js Component
       |
       v
Feature API Service
       |
       v
Shared API Client
       |
       v
Flask Blueprint Route
       |
       v
Marshmallow Validation
       |
       v
Service Layer
       |
       v
SQLAlchemy / PostgreSQL
```

Responsibilities:

- Components MUST NOT construct API requests directly.
- Feature API services MUST encapsulate endpoint-specific operations.
- The shared API client MUST handle common transport concerns.
- Flask routes MUST validate input and delegate business operations to services.
- Backend services MUST enforce business rules and authorization.
- Database access MUST remain inside the backend.

The frontend MUST NOT access PostgreSQL directly.

---

## 4. REST Endpoint Conventions

### 4.1 Resource Naming

Use lowercase plural nouns for collection resources.

| Resource | Endpoint |
|---|---|
| Users | `/users` |
| Boards | `/boards` |
| Board Members | `/boards/{boardId}/members` |
| Columns | `/boards/{boardId}/columns` |
| Cards | `/cards` |
| Comments | `/cards/{cardId}/comments` |
| Notifications | `/notifications` |

Rules:

- Use nouns rather than action names.
- Use plural resource names.
- Use lowercase letters.
- Use hyphens only when needed to separate compound words.
- Use path parameters for resource identifiers.
- Avoid deeply nested resource paths when they do not express a meaningful ownership relationship.

### 4.2 HTTP Methods

| Method | Purpose | Expected Behavior |
|---|---|---|
| GET | Retrieve resources | Must not modify persisted state |
| POST | Create resources or execute explicit operations | Creates a resource or performs a documented operation |
| PUT | Replace a resource | Replaces the target representation |
| PATCH | Partially update a resource | Updates only supplied fields |
| DELETE | Delete a resource | Removes or deactivates the target resource according to its contract |

Do not use GET for operations that modify data.

Prefer PATCH for partial updates rather than sending incomplete PUT payloads.

### 4.3 Canonical Endpoint Reference

The following endpoints define the proposed initial API surface.

#### Authentication

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/auth/register` | Register an account |
| POST | `/auth/login` | Authenticate a user |
| POST | `/auth/logout` | End the current session |
| GET | `/auth/me` | Retrieve the authenticated user |

#### Boards

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/boards` | List accessible boards |
| POST | `/boards` | Create a board |
| GET | `/boards/{boardId}` | Retrieve a board |
| PATCH | `/boards/{boardId}` | Update board details |
| DELETE | `/boards/{boardId}` | Delete a board |

#### Board Members

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/boards/{boardId}/members` | List board members |
| POST | `/boards/{boardId}/members` | Add a board member |
| PATCH | `/boards/{boardId}/members/{userId}` | Update a member's role |
| DELETE | `/boards/{boardId}/members/{userId}` | Remove a member |

#### Columns

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/boards/{boardId}/columns` | List board columns |
| POST | `/boards/{boardId}/columns` | Create a column |
| PATCH | `/columns/{columnId}` | Update a column |
| DELETE | `/columns/{columnId}` | Delete a column |
| PATCH | `/boards/{boardId}/columns/reorder` | Reorder columns |

#### Cards

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/cards` | List accessible cards |
| POST | `/cards` | Create a card |
| GET | `/cards/{cardId}` | Retrieve a card |
| PATCH | `/cards/{cardId}` | Update a card |
| DELETE | `/cards/{cardId}` | Delete a card |
| PATCH | `/cards/{cardId}/move` | Move a card |
| PATCH | `/columns/{columnId}/cards/reorder` | Reorder cards within a column |

#### Comments

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/cards/{cardId}/comments` | List card comments |
| POST | `/cards/{cardId}/comments` | Create a comment |
| PATCH | `/comments/{commentId}` | Update a comment |
| DELETE | `/comments/{commentId}` | Delete a comment |

#### Notifications

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/notifications` | List notifications |
| PATCH | `/notifications/{notificationId}` | Update notification state |
| POST | `/notifications/read-all` | Mark all notifications as read |

Only implement endpoints for approved features. This table is the proposed contract, not authorization to create every feature immediately.

---

## 5. Request Standards

### 5.1 Content Type

JSON request bodies MUST use:

```http
Content-Type: application/json
Accept: application/json
```

GET and DELETE requests generally do not require a request body.

### 5.2 Naming Convention

Use `camelCase` for JSON properties.

Use `snake_case` for Python variables and SQLAlchemy database columns.

Example request:

```json
{
  "title": "Implement authentication",
  "description": "Build login and registration",
  "priority": "high",
  "dueDate": "2026-12-01T17:00:00Z"
}
```

The backend MUST explicitly map JSON fields to its internal naming convention.

Do not expose SQLAlchemy model internals directly as API responses.

### 5.3 Request Validation

Every endpoint MUST validate relevant inputs:

- Path parameters.
- Query parameters.
- Request body.
- Content type when a body is required.
- Resource identifiers.
- Enum values.
- Field lengths and formats.

Validation MUST happen on the backend even when equivalent frontend validation exists.

The frontend provides immediate feedback; the backend enforces correctness.

### 5.4 Partial Updates

PATCH requests MUST distinguish between:

- An omitted property: leave the existing value unchanged.
- A property explicitly set to `null`: clear the value only if the field permits null.
- An invalid value: reject the request.

Example:

```http
PATCH /api/v1/cards/550e8400-e29b-41d4-a716-446655440000
```

```json
{
  "title": "Updated card title",
  "dueDate": null
}
```

The title changes and the due date is cleared, provided that the due date is nullable.

---

## 6. Response Standards

### 6.1 Success Response

Successful responses MUST use a consistent JSON structure.

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Implement authentication",
    "status": "in_progress",
    "priority": "high"
  }
}
```

Collection responses:

```json
{
  "data": [
    {
      "id": "card-001",
      "title": "Implement authentication"
    },
    {
      "id": "card-002",
      "title": "Build dashboard"
    }
  ]
}
```

Do not return different top-level response structures for equivalent resource operations.

### 6.2 Pagination Metadata

Paginated collection responses MUST include metadata.

```json
{
  "data": [],
  "meta": {
    "pagination": {
      "page": 1,
      "perPage": 20,
      "totalItems": 45,
      "totalPages": 3
    }
  }
}
```

Metadata MUST accurately reflect the applied filters and the returned result set.

### 6.3 HTTP Status Codes

| Status | Meaning | Usage |
|---|---|---|
| 200 | OK | Successful retrieval or update |
| 201 | Created | Resource successfully created |
| 202 | Accepted | Operation accepted for asynchronous processing |
| 204 | No Content | Successful operation with no response body |
| 400 | Bad Request | Malformed or invalid request |
| 401 | Unauthorized | Missing or invalid authentication |
| 403 | Forbidden | Authenticated user lacks permission |
| 404 | Not Found | Resource does not exist or is intentionally undisclosed |
| 409 | Conflict | Resource state or uniqueness conflict |
| 422 | Unprocessable Entity | Semantically invalid input, if adopted consistently |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Unexpected backend failure |
| 503 | Service Unavailable | Backend or required dependency unavailable |

Use status codes consistently. Do not return HTTP 200 for failed operations.

Choose one validation status convention, 400 or 422, and apply it consistently across the API. The recommended default for this project is 400 for request validation failures.

---

## 7. Error Response Standards

### 7.1 Standard Error Format

All API errors MUST follow the same structure.

```json
{
  "error": {
    "code": "CARD_NOT_FOUND",
    "message": "The requested card could not be found.",
    "details": null
  }
}
```

Validation example:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request contains invalid fields.",
    "details": {
      "title": [
        "Title is required."
      ]
    }
  }
}
```

Rules:

- `code` MUST be a stable machine-readable identifier.
- `message` MUST be safe to display to users.
- `details` MAY contain field-level validation information.
- Internal stack traces, SQL queries, credentials, and infrastructure details MUST never be exposed.
- Frontend behavior MUST depend on error codes or HTTP status codes, not message text.

### 7.2 Standard Error Codes

| Error Code | HTTP Status | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Invalid request data |
| `UNAUTHENTICATED` | 401 | Authentication required |
| `INVALID_CREDENTIALS` | 401 | Invalid login credentials |
| `FORBIDDEN` | 403 | Insufficient permission |
| `RESOURCE_NOT_FOUND` | 404 | Resource unavailable |
| `DUPLICATE_RESOURCE` | 409 | Resource conflicts with existing data |
| `RESOURCE_CONFLICT` | 409 | Operation conflicts with current resource state |
| `RATE_LIMIT_EXCEEDED` | 429 | Request rate exceeded |
| `INTERNAL_SERVER_ERROR` | 500 | Unexpected server failure |
| `SERVICE_UNAVAILABLE` | 503 | Required service unavailable |

Domain-specific codes MAY be introduced when they represent a meaningful, stable error condition.

### 7.3 Frontend Error Handling

The shared API client MUST normalize API failures into a predictable error type.

Frontend components MUST handle relevant states:

- Loading.
- Success.
- Validation failure.
- Authentication failure.
- Authorization failure.
- Not found.
- Conflict.
- Network failure.
- Unexpected server failure.

Do not silently swallow errors.

Display user-friendly messages while retaining technical context for diagnostics.

---

## 8. Authentication and Authorization

### 8.1 Authentication

All protected endpoints MUST require a valid authenticated session.

The recommended browser authentication approach is:

- HttpOnly cookies.
- Secure cookies in production.
- Appropriate SameSite policy.
- Backend-controlled session or token validation.
- CSRF protection when cookie-based authentication requires it.

If JWT authentication is adopted, token validation MUST follow the security standards in `security.md`.

The frontend MUST NOT treat a locally stored user object as proof of authentication.

### 8.2 Authorization

Authentication and authorization are separate responsibilities.

The backend MUST verify that the authenticated user has permission to access the requested resource.

Example:

```text
GET /api/v1/boards/{boardId}
```

The backend MUST verify:

1. The user is authenticated.
2. The board exists or is intentionally undisclosed.
3. The user has access to that board.
4. The requested operation is permitted.

Never trust a client-supplied `userId`, `ownerId`, or role to establish ownership or permissions.

### 8.3 Resource Ownership

For user-owned resources, ownership MUST be derived from the authenticated identity.

For board-scoped resources, authorization MUST verify board membership and the applicable permission.

The exact permission matrix must be approved separately before implementing role-sensitive endpoints.

---

## 9. Pagination, Filtering, and Sorting

### 9.1 Pagination

Collection endpoints that may return large datasets MUST support pagination.

Recommended query parameters:

```text
?page=1&perPage=20
```

Rules:

- Default page: `1`.
- Default page size: `20`.
- Maximum page size: `100`.
- Reject invalid negative values.
- Use deterministic ordering.
- Avoid loading unbounded collections.

### 9.2 Filtering

Use query parameters for filtering.

Example:

```http
GET /api/v1/cards?status=in_progress&priority=high
```

Multiple filters MUST be combined using AND semantics unless explicitly documented otherwise.

Unsupported filters MUST be rejected or explicitly ignored according to a documented endpoint policy. Prefer rejecting invalid filter values.

### 9.3 Search

Use a consistent `search` query parameter.

```http
GET /api/v1/cards?search=authentication
```

Search behavior MUST document:

- Which fields are searchable.
- Whether matching is case-insensitive.
- Whether partial matching is supported.
- Whether search applies before or after pagination.

### 9.4 Sorting

Use explicit sort parameters.

```http
GET /api/v1/cards?sortBy=createdAt&sortOrder=desc
```

Rules:

- Only documented sortable fields are allowed.
- Default ordering MUST be documented.
- Sorting MUST be deterministic.
- Add a stable secondary sort key when primary values are equal.
- Never interpolate arbitrary client input into SQL ordering expressions.

---

## 10. Resource Data Contracts

### 10.1 Identifier Format

API resource identifiers MUST use UUID strings for core entities if UUID is adopted by the database design.

Example:

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000"
}
```

The frontend MUST treat identifiers as opaque strings.

Do not depend on the internal database representation of an identifier.

### 10.2 Timestamps

Use ISO 8601 timestamps with explicit timezone information.

Example:

```json
{
  "createdAt": "2026-11-19T10:30:00Z",
  "updatedAt": "2026-11-19T11:45:00Z"
}
```

Rules:

- Store timestamps in UTC.
- Return timestamps in UTC.
- Include timezone information.
- Do not return ambiguous timezone-free datetime strings.
- Convert timestamps for display in the frontend.

Date-only values MUST use `YYYY-MM-DD` and MUST NOT be silently interpreted as UTC timestamps.

### 10.3 Enum Values

Enum values MUST be documented and consistent across frontend and backend.

Proposed card status:

```text
todo
in_progress
done
```

Proposed priority:

```text
low
medium
high
```

Rules:

- Use lowercase `snake_case` values for multiword enums.
- Do not expose database-specific enum representations.
- Reject unsupported values.
- Do not silently convert unknown values to defaults.

### 10.4 Card Resource Example

Proposed response:

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "boardId": "660e8400-e29b-41d4-a716-446655440000",
    "columnId": "770e8400-e29b-41d4-a716-446655440000",
    "title": "Implement authentication",
    "description": "Build login and registration workflows.",
    "status": "in_progress",
    "priority": "high",
    "dueDate": "2026-12-01T17:00:00Z",
    "position": 1,
    "createdBy": "880e8400-e29b-41d4-a716-446655440000",
    "createdAt": "2026-11-19T10:30:00Z",
    "updatedAt": "2026-11-19T11:45:00Z"
  }
}
```

This is a proposed API representation, not a requirement to expose every database field. Only return fields that the consumer needs and is authorized to see.

---

## 11. Card Movement and Reordering

Card movement and reordering require special contract rules because they affect multiple resources and ordering state.

### 11.1 Move Card

Proposed request:

```http
PATCH /api/v1/cards/{cardId}/move
```

```json
{
  "targetColumnId": "770e8400-e29b-41d4-a716-446655440001",
  "position": 2
}
```

The backend MUST:

1. Verify access to the source card and target column.
2. Verify both resources belong to the appropriate board.
3. Validate the target position.
4. Perform the movement transactionally.
5. Maintain valid ordering.
6. Return the updated card representation.

### 11.2 Reorder Columns

Proposed request:

```http
PATCH /api/v1/boards/{boardId}/columns/reorder
```

```json
{
  "items": [
    {
      "id": "column-001",
      "position": 0
    },
    {
      "id": "column-002",
      "position": 1
    }
  ]
}
```

### 11.3 Reorder Cards

Proposed request:

```http
PATCH /api/v1/columns/{columnId}/cards/reorder
```

```json
{
  "items": [
    {
      "id": "card-001",
      "position": 0
    },
    {
      "id": "card-002",
      "position": 1
    }
  ]
}
```

The backend MUST reject:

- Duplicate identifiers.
- Duplicate positions when the contract requires unique positions.
- Cards that do not belong to the target column.
- Cards from another board.
- Unauthorized reorder operations.
- Invalid or incomplete reorder payloads when a complete list is required.

All position changes MUST be committed in one database transaction.

Concurrent reorder operations MUST NOT silently corrupt ordering. Use an appropriate concurrency strategy, such as row locking or version checks.

---

## 12. Concurrency and Idempotency

### 12.1 Concurrent Updates

The backend MUST consider the possibility that multiple users update the same resource simultaneously.

For resources where lost updates are unacceptable, implement optimistic concurrency using a version field or HTTP conditional requests such as ETags and `If-Match`.

A stale update SHOULD return:

```http
409 Conflict
```

with:

```json
{
  "error": {
    "code": "RESOURCE_CONFLICT",
    "message": "The resource has changed. Refresh and try again.",
    "details": null
  }
}
```

The exact concurrency mechanism MUST be defined by the relevant resource contract.

### 12.2 Idempotency

Operations that may be retried after network failures MUST be designed to avoid unintended duplicate effects.

For operations such as payments, invitations, or other externally consequential actions, use an idempotency key where appropriate.

Do not add idempotency infrastructure to every endpoint without a concrete requirement.

---

## 13. Frontend API Client Standards

### 13.1 Shared API Client

All frontend API requests MUST use a shared API client.

Suggested structure:

```text
frontend/src/
├── lib/
│   └── api/
│       ├── client.ts
│       ├── errors.ts
│       ├── types.ts
│       └── config.ts
└── features/
    ├── auth/
    │   └── services/
    │       └── authApi.ts
    ├── boards/
    │   └── services/
    │       └── boardApi.ts
    └── cards/
        └── services/
            └── cardApi.ts
```

Responsibilities:

- `client.ts`: HTTP transport, common headers, credentials, and response handling.
- `errors.ts`: normalized API error representation.
- `types.ts`: shared transport-level TypeScript types.
- `config.ts`: API configuration.
- Feature API services: endpoint-specific request functions.

### 13.2 TypeScript Contracts

Define explicit request and response types.

Example:

```ts
export interface CreateCardRequest {
  title: string;
  description?: string;
  columnId: string;
  priority?: "low" | "medium" | "high";
  dueDate?: string | null;
}

export interface CardResponse {
  id: string;
  boardId: string;
  columnId: string;
  title: string;
  description: string | null;
  status: "todo" | "in_progress" | "done";
  priority: "low" | "medium" | "high";
  dueDate: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
}
```

Use separate types for:

- Request payloads.
- Response payloads.
- Domain models.
- Form state.
- Query parameters.

Do not use one overly broad interface for every API operation.

Avoid `any`. Prefer explicit types and runtime validation at untrusted boundaries where appropriate.

### 13.3 API Service Example

```ts
export async function createCard(
  payload: CreateCardRequest
): Promise<CardResponse> {
  const response = await apiClient.post<{ data: CardResponse }>(
    "/cards",
    payload
  );

  return response.data.data;
}
```

Components MUST call feature services rather than embedding endpoint URLs and HTTP logic.

### 13.4 Server and Client Boundaries

Next.js Server Components and server-side services MUST follow the project's server/client security boundaries.

- Do not expose private backend secrets through `NEXT_PUBLIC_` variables.
- Do not assume browser and server requests have identical cookie behavior.
- Do not forward authentication credentials to untrusted origins.
- Do not duplicate backend authorization checks with frontend-only conditions.
- Do not serialize sensitive backend-only fields into client props.

---

## 14. API Contract Documentation

Every implemented endpoint MUST document:

1. HTTP method.
2. Endpoint path.
3. Authentication requirement.
4. Authorization requirement.
5. Path parameters.
6. Query parameters.
7. Request body schema.
8. Successful response schema.
9. Possible error codes.
10. Business rules.
11. Side effects and transaction behavior, when relevant.

Use OpenAPI as the machine-readable API specification when practical.

Recommended location:

```text
docs/
└── api/
    ├── openapi.yaml
    └── README.md
```

The OpenAPI document MUST remain consistent with the implemented Flask routes and frontend contracts.

Do not document endpoints as implemented until they actually exist and have been verified.

---

## 15. API Versioning and Compatibility

Use a versioned API prefix:

```text
/api/v1
```

Non-breaking changes MAY be introduced within the existing version:

- Adding optional response fields.
- Adding new endpoints.
- Adding optional query parameters.
- Adding new resources without changing existing behavior.

Breaking changes REQUIRE a deliberate versioning and migration strategy.

Examples of breaking changes:

- Renaming or removing response fields.
- Changing field types.
- Changing authentication behavior.
- Changing endpoint paths.
- Changing the meaning of existing enum values.
- Changing required request properties.
- Changing established error semantics.

Do not silently change an existing contract.

---

## 16. API Testing Requirements

Every endpoint MUST have tests for relevant behavior.

### 16.1 Backend API Tests

Use Pytest to verify:

- Successful requests.
- Invalid payloads.
- Missing required fields.
- Invalid identifiers.
- Authentication failures.
- Authorization failures.
- Resource ownership.
- Not-found behavior.
- Duplicate resource conflicts.
- Database transaction behavior.
- Response schema consistency.

### 16.2 Frontend API Tests

Verify:

- Correct endpoint and HTTP method.
- Correct request payload.
- Correct response mapping.
- Correct error normalization.
- Loading and failure behavior.
- Authentication expiration behavior.
- Handling of empty and paginated results.

### 16.3 Contract Consistency

Frontend and backend contracts MUST agree on:

- Field names.
- Field types.
- Required and optional properties.
- Nullable values.
- Enum values.
- HTTP status codes.
- Error codes.
- Pagination metadata.
- Timestamp formats.

Use OpenAPI-based validation or contract tests when the project adopts a machine-readable specification.

---

## 17. AI Coding Agent Instructions

When creating or modifying API functionality, AI coding agents MUST:

1. Inspect existing frontend services and Flask routes before making changes.
2. Read this document and the relevant frontend/backend steering files.
3. Identify the affected request and response contracts.
4. Reuse existing API client and error-handling conventions.
5. Define or update TypeScript request and response types.
6. Validate incoming data through Marshmallow schemas.
7. Enforce authorization in the backend service layer.
8. Update API documentation when the contract changes.
9. Add or update backend and frontend tests.
10. Verify that both sides use compatible field names and data types.
11. Avoid unrelated endpoint or response-format changes.
12. Report any contract assumptions that require product or architecture approval.

AI agents MUST NOT:

- Invent new endpoint paths without checking existing conventions.
- Return SQLAlchemy models directly from routes.
- Trust client-supplied ownership or permission fields.
- Use inconsistent response formats.
- Hardcode backend URLs.
- expose internal exceptions or stack traces.
- Change existing API contracts without assessing compatibility.
- Claim contract tests passed unless they were executed successfully.

---

## 18. Definition of Done

An API implementation is complete only when:

- [ ] Endpoint follows REST naming and HTTP method conventions.
- [ ] Request and response contracts are documented.
- [ ] Authentication and authorization are enforced where required.
- [ ] Marshmallow validation is implemented.
- [ ] Standard success response format is used.
- [ ] Standard error response format is used.
- [ ] HTTP status codes are correct.
- [ ] TypeScript contracts match backend serialization.
- [ ] Frontend uses the shared API client.
- [ ] Database changes follow `database.md`.
- [ ] Relevant backend API tests pass.
- [ ] Relevant frontend tests pass.
- [ ] API documentation is updated.
- [ ] No sensitive information is exposed.
- [ ] Existing consumers remain compatible or a migration plan exists.

---

## 19. Engineering Decision Priority

When API implementation decisions conflict, use this priority:

1. Security and authorization.
2. Data integrity and transaction correctness.
3. Existing approved requirements and domain rules.
4. Backward compatibility.
5. Contract consistency.
6. Maintainability and testability.
7. Performance and scalability.
8. Implementation convenience.

A simpler implementation MUST NOT compromise security, data integrity, or established API behavior.