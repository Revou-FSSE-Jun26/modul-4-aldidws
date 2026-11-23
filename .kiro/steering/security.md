---
inclusion: always
---

# Security Engineering Standards

## 1. Purpose

This document defines mandatory security requirements for the Task Management Application.

Security MUST be considered throughout design, implementation, testing, deployment, and maintenance.

The primary objectives are to:

- Protect user accounts and application data.
- Prevent unauthorized access to boards, columns, cards, and comments.
- Protect authentication credentials and sessions.
- Prevent common web application vulnerabilities.
- Maintain data integrity and confidentiality.
- Provide secure error handling and operational logging.

These standards apply to the Next.js frontend, Flask backend, PostgreSQL database, deployment infrastructure, and development workflow.

---

## 2. Security Principles

All contributors and AI coding agents MUST follow these principles:

1. **Defense in Depth** — do not depend on a single security control.
2. **Least Privilege** — grant only the permissions required.
3. **Server-Side Enforcement** — never trust frontend-only security checks.
4. **Secure Defaults** — new functionality must be secure by default.
5. **Explicit Trust Boundaries** — validate data crossing application boundaries.
6. **Fail Securely** — failed authentication or authorization must not grant access.
7. **Data Minimization** — collect, expose, and retain only necessary data.
8. **No Secret Exposure** — credentials and private configuration must never enter source control or client bundles.
9. **Auditability** — security-relevant failures and events must be observable without logging secrets.
10. **Continuous Verification** — security controls must be tested.

Use OWASP guidance as a reference when assessing web application security risks.

---

## 3. Authentication

### 3.1 Identity Verification

The backend MUST authenticate users before allowing access to protected resources.

Authentication MUST:

- Verify credentials on the server.
- Use secure password hashing.
- Reject invalid or expired authentication credentials.
- Prevent access to protected endpoints without a valid session.
- Avoid revealing whether an account exists during login or password recovery.
- Apply rate limiting to sensitive authentication endpoints.

### 3.2 Password Storage

Passwords MUST:

- Be hashed using Argon2id or an appropriately configured bcrypt implementation.
- Never be stored in plaintext.
- Never be logged.
- Never be returned through API responses.
- Never be included in frontend application state or browser storage.

Do not implement custom password hashing algorithms.

### 3.3 Session and Token Management

Choose and document one authoritative authentication strategy.

Preferred browser-based strategy:

- Use server-managed sessions or short-lived tokens transported through appropriately configured cookies.
- Set cookies with `HttpOnly`, `Secure`, and an appropriate `SameSite` policy.
- Rotate session identifiers after authentication and privilege changes.
- Invalidate sessions during logout.
- Support session expiration.
- Provide a defined session revocation strategy.

If JWT is selected:

- Validate signature, issuer, audience, expiration, and relevant claims.
- Use an explicit signing algorithm allowlist.
- Do not accept unsigned or unexpected algorithms.
- Keep access tokens short-lived.
- Define refresh-token rotation and revocation behavior.
- Never store long-lived credentials in `localStorage` or `sessionStorage`.

Do not implement multiple competing authentication mechanisms without a documented reason.

### 3.4 Authentication Responses

Use appropriate HTTP status codes:

- `401 Unauthorized`: authentication is missing or invalid.
- `403 Forbidden`: the authenticated user lacks permission.

Authentication errors MUST NOT expose password hashes, token details, or internal authentication state.

---

## 4. Authorization and Access Control

### 4.1 Backend Enforcement

Every protected backend endpoint MUST enforce authorization.

Frontend route guards and hidden UI controls are not authorization mechanisms.

The backend MUST independently verify the authenticated user's permission for each requested operation.

### 4.2 Resource Ownership

Every resource access MUST validate its ownership or membership relationship.

Examples:

- A user may access a private board only if they own it or have an authorized membership.
- A column can be accessed only through an authorized board.
- A card can be modified only when the user has permission on its parent board.
- A comment can be modified or deleted only according to its author and board permissions.

Never trust resource IDs supplied by the client.

### 4.3 Role-Based Permissions

Use explicit permissions rather than scattered role-name comparisons.

If board collaboration is supported, define board-specific permissions separately from global account roles.

Example permission matrix (subject to approved product requirements):

| Action | Owner | Editor | Viewer |
|---|---:|---:|---:|
| View board | Yes | Yes | Yes |
| Update board settings | Yes | No | No |
| Manage members | Yes | No | No |
| Create and edit cards | Yes | Yes | No |
| Move cards | Yes | Yes | No |
| Delete cards | Yes | Yes, if permitted | No |
| Add comments | Yes | Yes | Yes, if permitted |

The final matrix MUST be approved before implementation.

### 4.4 Insecure Direct Object Reference (IDOR)

The backend MUST prevent users from accessing another user's resources by changing IDs in requests.

For every nested resource request:

1. Resolve the requested resource.
2. Verify its parent relationship.
3. Verify the authenticated user's access.
4. Perform the requested operation only after authorization succeeds.

Do not rely on UUIDs or unpredictable IDs as an authorization mechanism.

### 4.5 Unauthorized Resource Disclosure

Define a consistent policy for inaccessible resources.

Use `403` when the resource is known but the user lacks permission.

Use `404` when resource existence should not be disclosed.

Apply the policy consistently across related endpoints.

---

## 5. Input Validation

All untrusted input MUST be validated on the backend.

Validate:

- Request bodies.
- Query parameters.
- Route parameters.
- Headers used by application logic.
- Uploaded files, if supported.
- Pagination and sorting parameters.

Validation MUST include:

- Required fields.
- Data types.
- Length limits.
- Allowed enum values.
- Numeric ranges.
- Date and timestamp formats.
- Relationship and ownership constraints.
- Unexpected or unsupported fields where appropriate.

Use Marshmallow schemas for request validation according to `backend.md`.

Frontend validation improves usability but MUST NOT replace backend validation.

---

## 6. Injection Prevention

### 6.1 SQL Injection

- Use SQLAlchemy query expressions and parameterized queries.
- Never concatenate untrusted input into SQL statements.
- Avoid raw SQL unless necessary and safely parameterized.
- Validate dynamic sorting and filtering fields against allowlists.
- Never expose database error messages to clients.

### 6.2 Cross-Site Scripting (XSS)

- Use React's default escaping behavior.
- Avoid rendering untrusted HTML.
- Do not use `dangerouslySetInnerHTML` with untrusted content.
- Sanitize HTML when rich-text functionality is explicitly required.
- Validate URLs before rendering user-controlled links.
- Consider Content Security Policy (CSP) as an additional defense.

### 6.3 Command Injection

- Avoid shell execution for application features.
- Never interpolate user-controlled values into shell commands.
- Use safe library APIs instead of operating-system commands where possible.

---

## 7. Cross-Site Request Forgery (CSRF)

When cookie-based authentication is used:

- Implement an appropriate CSRF protection mechanism for state-changing requests.
- Validate CSRF tokens on protected operations.
- Use appropriate `SameSite` cookie settings.
- Validate request origins where applicable.
- Do not assume `SameSite` alone provides complete CSRF protection.

State-changing operations include POST, PUT, PATCH, and DELETE.

If bearer tokens are used instead, assess the actual token storage and browser transport design rather than assuming CSRF is impossible.

---

## 8. Cross-Origin Resource Sharing (CORS)

CORS MUST be explicitly configured.

- Allow only approved frontend origins.
- Avoid wildcard origins when credentials are enabled.
- Restrict allowed HTTP methods.
- Restrict allowed headers.
- Enable credentials only when required.
- Keep development and production origin configuration separate.

Never use unrestricted CORS as a workaround for deployment configuration problems.

---

## 9. Sensitive Data Protection

The application MUST protect:

- Passwords and password hashes.
- Session identifiers and authentication tokens.
- Database credentials.
- API keys and signing secrets.
- Private user information.
- Internal infrastructure details.

Rules:

- Do not commit secrets to Git.
- Do not expose server-only environment variables through public frontend variables.
- Do not return sensitive model fields in API responses.
- Do not include credentials in URLs.
- Do not log authentication tokens or passwords.
- Use HTTPS for deployed environments.
- Restrict database access to trusted application infrastructure.
- Use least-privilege database credentials.

Use separate credentials for development, testing, staging, and production.

---

## 10. Security Headers

Configure appropriate HTTP security headers at the application or trusted reverse-proxy layer.

Evaluate and configure:

- Content-Security-Policy.
- Strict-Transport-Security in HTTPS environments.
- X-Content-Type-Options.
- Referrer-Policy.
- Frame protection through CSP `frame-ancestors` or an appropriate equivalent.
- Permissions-Policy.

Avoid deploying a CSP that breaks application functionality without testing it.

Do not expose unnecessary server or framework version information.

---

## 11. Rate Limiting and Abuse Prevention

Apply rate limits to sensitive or abuse-prone endpoints.

At minimum, assess:

- Login.
- Registration.
- Password recovery.
- Invitation or membership operations.
- Expensive search endpoints.
- Other operations that can generate significant resource consumption.

Also enforce:

- Maximum request body sizes.
- Pagination limits.
- Input length limits.
- Reasonable request timeouts.
- Appropriate upload limits if uploads are supported.

Rate limiting MUST work correctly across multiple application instances. Do not rely on process-local counters in a multi-instance deployment.

---

## 12. File Upload Security

File upload functionality MUST NOT be introduced without a defined security design.

If uploads are supported:

- Enforce file size limits.
- Validate allowed file types.
- Inspect actual file content rather than trusting extensions.
- Generate server-side filenames.
- Prevent path traversal.
- Store uploads outside executable application directories.
- Restrict public access where appropriate.
- Consider malware scanning for higher-risk use cases.
- Avoid serving untrusted uploads as executable content.

---

## 13. Error Handling and Logging

### 13.1 Error Responses

- Return safe and consistent error responses.
- Never expose stack traces to clients.
- Never expose SQL statements, credentials, or internal paths.
- Avoid leaking account existence through authentication flows.
- Use stable machine-readable error codes.

### 13.2 Security Logging

Log relevant security events:

- Failed authentication attempts.
- Successful authentication where operationally appropriate.
- Authorization failures.
- Session revocation events.
- Sensitive account changes.
- Unexpected security-related exceptions.

Logs SHOULD include:

- Timestamp.
- Severity.
- Request ID.
- Endpoint and HTTP method.
- Event type.
- User ID when available.
- Result or status code.

Never log passwords, tokens, session cookies, secrets, or unnecessary personal data.

Protect logs from unauthorized access and excessive retention.

---

## 14. Database Security

- Use least-privilege database accounts.
- Require encrypted database connections in deployed environments.
- Restrict database network access.
- Use parameterized queries through SQLAlchemy.
- Enforce foreign keys and integrity constraints.
- Protect backups.
- Do not use production data in development or tests without approved anonymization.
- Never expose database credentials to frontend code.

Database schema and integrity rules are defined in `database.md`.

---

## 15. Dependency and Supply Chain Security

- Use maintained dependencies.
- Review new dependencies before installation.
- Commit dependency lockfiles.
- Remove unused packages.
- Monitor known vulnerabilities.
- Update vulnerable dependencies promptly.
- Avoid installing packages from untrusted sources.
- Do not disable security checks to bypass dependency warnings without documented justification.

Run dependency security checks in CI where supported.

---

## 16. Environment and Deployment Security

- Use separate environments for development, testing, staging, and production.
- Store production secrets in the deployment platform's secret manager.
- Disable debug mode in production.
- Use HTTPS for all deployed application traffic.
- Restrict administrative access.
- Apply secure database networking rules.
- Verify CORS, cookie, and CSRF settings in production.
- Keep error responses safe in production.
- Define backup and recovery procedures.

Never copy production secrets into local configuration files or repository examples.

---

## 17. Security Testing

Security MUST be tested as part of normal development.

Required test areas include:

- Unauthenticated access to protected endpoints.
- Unauthorized access to another user's resources.
- Invalid or expired authentication credentials.
- Role and membership permission enforcement.
- Request validation failures.
- SQL injection-resistant query behavior.
- XSS-safe rendering of user-generated content.
- CSRF protection when cookie authentication is used.
- Rate limiting for sensitive endpoints.
- Sensitive field exposure in API responses.
- Secure error responses.

Use Pytest for backend security tests and Playwright for browser-facing authentication and authorization workflows.

---

## 18. Security Incident Handling

If a security vulnerability or exposure is discovered:

1. Assess the affected systems and data.
2. Contain the issue.
3. Revoke or rotate compromised credentials when necessary.
4. Preserve relevant logs and evidence.
5. Identify the root cause.
6. Implement and test the fix.
7. Review related functionality for similar weaknesses.
8. Document the incident and preventive actions.

Do not conceal security failures or continue deploying affected changes without an appropriate risk decision.

---

## 19. AI Coding Agent Security Rules

AI coding agents MUST:

1. Never hardcode secrets or credentials.
2. Never weaken authentication or authorization to make a test pass.
3. Never trust frontend-only permission checks.
4. Never expose internal exception details through API responses.
5. Never remove security tests without explicit justification.
6. Never bypass input validation.
7. Never use production data for testing without authorization.
8. Never execute destructive database operations without explicit authorization.
9. Review security implications before adding dependencies or endpoints.
10. Report security assumptions and unresolved risks.

When security requirements are unclear, ask for clarification instead of implementing a weaker default.

---

## 20. Security Definition of Done

- [ ] Authentication is enforced where required.
- [ ] Authorization is enforced on the backend.
- [ ] Resource ownership and membership are verified.
- [ ] Untrusted input is validated.
- [ ] Database queries are protected against injection.
- [ ] User-generated content is handled safely.
- [ ] CSRF protection is implemented where applicable.
- [ ] CORS is restricted to approved origins.
- [ ] Secrets are not exposed or committed.
- [ ] Error responses do not expose internal details.
- [ ] Sensitive events are logged safely.
- [ ] Relevant security tests pass.
- [ ] Deployment configuration follows secure defaults.

Security requirements take priority over convenience, implementation speed, and frontend presentation behavior.