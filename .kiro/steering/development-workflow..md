---
inclusion: always
---

# Development Workflow Standards

## 1. Purpose

This document defines the mandatory development workflow for all contributors and AI coding agents working on this project.

The goal is to ensure that every change is:
- Aligned with approved requirements and business objectives.
- Consistent with the existing architecture and coding standards.
- Secure, maintainable, and testable.
- Verified before being reported as complete.
- Small enough to review and safe enough to integrate.

These guidelines apply to new features, bug fixes, refactoring, performance improvements, and configuration changes.

---

## 2. Core Engineering Principles

All development work MUST follow these principles:

1. **Understand Before Implementing** — inspect the requirements and existing code before making changes.
2. **Plan Before Complex Changes** — define the implementation approach and affected components before modifying multiple files or system boundaries.
3. **Preserve Existing Behavior** — avoid unrelated changes and regressions.
4. **Follow Established Architecture** — reuse existing patterns unless there is a documented reason to change them.
5. **Prefer Simplicity** — implement the smallest solution that correctly satisfies the requirement.
6. **Validate Every Change** — run relevant checks and tests before reporting completion.
7. **Make Failures Explicit** — never silently ignore errors or hide incomplete work.
8. **Protect Existing Data** — treat database migrations, destructive operations, and production data changes as high-risk operations.
9. **Document Important Decisions** — record architectural decisions and non-obvious trade-offs.
10. **Never Fabricate Results** — report only commands, tests, and checks that were actually executed.

---

## 3. Standard Development Lifecycle

Every task MUST follow the applicable stages below.

### Stage 1: Understand

Before implementation:

1. Read the user's request carefully.
2. Identify the problem being solved and the expected outcome.
3. Locate relevant requirements, design specifications, and steering files.
4. Identify acceptance criteria and expected behavior.
5. Identify constraints, dependencies, and potential risks.
6. Determine whether clarification is necessary.

For existing functionality:

- Inspect the relevant source files.
- Trace the current execution flow.
- Identify related components, services, API endpoints, models, and tests.
- Understand existing conventions before introducing new patterns.

**Do not assume that a requested change requires a complete rewrite.**

### Stage 2: Investigate

Inspect the project before deciding how to implement the change.

Investigate:

- Existing directory and module structure.
- Related frontend and backend implementations.
- Existing API contracts and database relationships.
- Authentication and authorization requirements.
- Existing validation and error-handling behavior.
- Relevant tests and test fixtures.
- Dependencies and configuration that may affect the change.

Prefer reusing existing functionality over creating duplicate implementations.

If existing code conflicts with the approved specifications, identify the conflict before proceeding.

### Stage 3: Plan

Create an implementation plan when a task involves multiple files, architectural changes, database changes, or non-trivial business logic.

The plan SHOULD identify:

- The proposed solution.
- Files and modules expected to change.
- New components, services, endpoints, or models.
- Data flow and dependencies.
- Validation and error-handling requirements.
- Security and authorization considerations.
- Required database migrations.
- Tests needed to verify the behavior.
- Risks and possible regressions.

For small, isolated changes, a short plan is sufficient.

Do not create unnecessary planning documents for trivial changes.

### Stage 4: Design

Before implementation, confirm that the proposed solution respects the project's architecture.

Evaluate:

- Separation of responsibilities.
- Frontend/backend boundaries.
- API request and response contracts.
- Database ownership and relationships.
- Authentication and authorization.
- Loading, empty, success, and error states.
- Accessibility and responsive behavior.
- Performance and scalability implications.

For architectural decisions that materially affect the system, document the decision in an Architecture Decision Record (ADR).

Do not silently introduce new frameworks, libraries, architectural patterns, or infrastructure.

### Stage 5: Implement

Implementation MUST follow the relevant engineering standards:

- `frontend.md` for frontend development.
- `backend.md` for Flask backend development.
- `database.md` for PostgreSQL and SQLAlchemy.
- `testing.md` and Playwright specifications for testing.
- `security.md` for security-sensitive changes.
- `api-contracts.md` for API behavior.

General implementation rules:

1. Make focused, incremental changes.
2. Follow existing naming conventions and project structure.
3. Reuse existing components, services, utilities, and abstractions where appropriate.
4. Keep business logic out of presentation components and route handlers.
5. Validate untrusted input at system boundaries.
6. Enforce authorization on the backend, not only in the frontend.
7. Handle expected failures explicitly.
8. Avoid unnecessary dependencies.
9. Do not introduce unrelated refactoring.
10. Do not leave placeholder implementations, dead code, or unexplained TODO comments.

When modifying existing files, preserve unrelated functionality and changes.

### Stage 6: Verify

Verification is mandatory before a task can be considered complete.

Run checks appropriate to the affected area.

**Frontend**
- TypeScript type checking.
- ESLint.
- Relevant component or integration tests.
- Build verification when appropriate.
- Responsive and accessibility checks for UI changes.

**Backend**
- Python tests with Pytest.
- Request validation tests.
- Service and integration tests.
- Authentication and authorization tests.
- API response and error-handling tests.

**Database**
- Migration generation and review.
- Migration upgrade verification.
- Constraint and relationship validation.
- Transaction and rollback testing where applicable.
- Data preservation checks for potentially destructive changes.

**End-to-End**
- Playwright tests for critical user journeys.
- Authentication and protected-route behavior.
- CRUD workflows.
- Relevant desktop and mobile behavior.

Verification rules:

- Run the checks most relevant to the change.
- Fix failures introduced by the implementation.
- Investigate unexpected failures instead of ignoring them.
- Do not modify or delete tests simply to make the suite pass.
- Do not claim that a test passed unless it was actually executed successfully.
- If a check cannot be run, report the reason and remaining risk.

### Stage 7: Review

Review the completed implementation before reporting it.

Ask:

- Does the change satisfy the original requirement?
- Does it follow the relevant steering standards?
- Is the implementation unnecessarily complex?
- Are edge cases handled?
- Are errors handled consistently?
- Are authentication and authorization enforced?
- Could existing functionality regress?
- Are tests sufficient?
- Are documentation and API contracts updated where necessary?
- Were unrelated files or behaviors changed?

Remove temporary debugging code and unused imports.

Do not introduce unrelated formatting changes or broad refactoring into a focused task.

### Stage 8: Report

Every completed task MUST end with a concise and accurate summary.

Include:

1. **Implemented** — what changed.
2. **Files Changed** — the main files or modules affected.
3. **Verification** — checks and tests actually executed, including results.
4. **Outstanding Issues** — known limitations, skipped checks, or unresolved risks.

Never describe incomplete work as complete.

---

## 4. Task Classification

Select the appropriate workflow depth based on the task's complexity and risk.

| Task type | Expected workflow |
|---|---|
| Small UI adjustment | Understand → Inspect → Implement → Verify |
| Isolated bug fix | Understand → Investigate → Implement → Test |
| New feature | Understand → Investigate → Plan → Design → Implement → Verify → Review |
| API modification | Investigate → Plan → Contract Review → Implement → Test |
| Database modification | Investigate → Plan → Migration Review → Implement → Verify |
| Authentication or security change | Investigate → Threat/Risk Review → Plan → Implement → Security Tests |
| Architecture change | Investigate → Evaluate Alternatives → ADR → Plan → Implement → Verify |
| Refactoring | Establish Existing Behavior → Plan → Refactor → Regression Tests |

Higher-risk changes require deeper investigation and verification, regardless of implementation size.

---

## 5. Requirements and Ambiguity Management

Requirements are the source of truth for expected product behavior.

When requirements are incomplete or ambiguous:

1. Identify the missing information.
2. Determine whether it affects functionality, security, data integrity, or architecture.
3. Ask for clarification when different interpretations would produce materially different results.
4. Do not invent business rules or silently make irreversible decisions.
5. If a low-risk assumption is necessary, state it explicitly and keep the implementation easy to change.

If implementation reveals a requirement conflict:

- Stop the affected implementation.
- Explain the conflict.
- Identify the affected requirements or specifications.
- Recommend a resolution.
- Continue only when the decision is sufficiently clear.

Never silently change approved acceptance criteria.

---

## 6. Change Management

### Scope Control

- Modify only files necessary for the task.
- Avoid unrelated refactoring.
- Preserve existing user changes.
- Do not overwrite work that has not been reviewed.
- Keep changes focused and reviewable.

### Dependency Management

Before adding a dependency:

1. Check whether the project already has an equivalent capability.
2. Evaluate maintenance status and compatibility.
3. Consider security, bundle size, and operational impact.
4. Prefer established dependencies over unnecessary custom implementations.
5. Explain significant dependency additions.

### Configuration Management

- Never commit secrets, credentials, or private keys.
- Use environment variables for environment-specific configuration.
- Keep example configuration files free of real credentials.
- Validate required environment variables at application startup.
- Do not silently change deployment configuration.

### Database Changes

- All schema changes MUST use version-controlled migrations.
- Review generated migrations before applying them.
- Preserve existing data unless deletion is explicitly required.
- Consider migration compatibility with deployed application versions.
- Never run destructive production operations without explicit authorization and a recovery plan.

### API Changes

- Treat existing API contracts as compatibility boundaries.
- Identify frontend and backend consumers before changing an endpoint.
- Update request/response schemas and relevant documentation.
- Avoid breaking changes unless explicitly approved.
- Test validation, authorization, and error responses.

---

## 7. Bug Fix Workflow

Every bug fix MUST begin by understanding the failure.

1. Reproduce the issue when possible.
2. Identify the expected and actual behavior.
3. Inspect logs, network requests, state transitions, and relevant code.
4. Determine the root cause rather than treating only the visible symptom.
5. Implement the smallest correct fix.
6. Add a regression test that fails before the fix and passes afterward, where practical.
7. Run relevant existing tests.
8. Report any conditions under which the issue could not be reproduced.

Do not introduce special-case workarounds without understanding their impact.

---

## 8. Refactoring Workflow

Refactoring MUST preserve externally observable behavior unless a behavior change is explicitly part of the task.

Before refactoring:

- Identify the existing behavior.
- Identify affected consumers.
- Review existing tests.
- Define the intended structural improvement.

During refactoring:

- Separate structural changes from functional changes where practical.
- Preserve public interfaces unless changes are approved.
- Avoid unnecessary abstractions.
- Keep changes incremental.

After refactoring:

- Run regression tests.
- Compare behavior before and after.
- Verify that no unrelated functionality changed.

---

## 9. AI Coding Agent Rules

AI coding agents MUST:

1. Read relevant steering files before modifying code.
2. Inspect existing implementations instead of assuming file structure or behavior.
3. Use actual project conventions and installed dependencies.
4. Never invent endpoints, database columns, functions, or configuration values.
5. Avoid replacing complete files when a focused modification is sufficient.
6. Avoid deleting existing functionality without explicit justification.
7. Ask before making decisions that materially affect product behavior or architecture.
8. Explain assumptions when proceeding with low-risk ambiguity.
9. Run relevant verification commands after implementation.
10. Report exact verification results honestly.
11. Identify files that were changed and explain significant decisions.
12. Avoid claiming that an implementation is production-ready solely because it compiles.

When a requested implementation conflicts with an existing standard:

- Identify the conflicting rule.
- Explain the impact.
- Recommend a consistent solution.
- Do not silently bypass the standard.

### Tool and Command Safety

Before executing commands:

- Understand their purpose and expected side effects.
- Prefer read-only inspection commands during investigation.
- Avoid destructive commands unless explicitly authorized.
- Never expose secrets in command output or reports.
- Do not overwrite user data or uncommitted changes.
- Review migration, deployment, and data-deletion commands before execution.

---

## 10. Definition of Done

A task is complete only when all applicable conditions are satisfied:

- [ ] The requested behavior is implemented.
- [ ] Approved requirements and acceptance criteria are satisfied.
- [ ] Existing architecture and engineering standards are followed.
- [ ] Input validation and error handling are implemented.
- [ ] Authentication and authorization are enforced where applicable.
- [ ] Database changes include reviewed migrations where applicable.
- [ ] Relevant tests have been added or updated.
- [ ] Relevant tests and quality checks have been executed.
- [ ] No known regression introduced by the change remains unresolved.
- [ ] Documentation and API contracts are updated where necessary.
- [ ] No secrets, temporary debugging code, or unintended files are included.
- [ ] Implementation results and outstanding limitations are reported accurately.

If any applicable condition is not satisfied, report the task as **partially complete** and explain what remains.

---

## 11. Engineering Decision Priority

When engineering decisions conflict, use this priority order:

1. Security and data integrity.
2. Approved product requirements.
3. Correctness and reliability.
4. Existing architecture and API compatibility.
5. Maintainability and testability.
6. Performance and scalability.
7. Development speed and convenience.

Choose the simplest solution that satisfies the highest-priority constraints.