# Requirements Document

## Introduction

This document defines the architecture, implementation standards, execution requirements, and quality criteria for End-to-End (E2E) testing of the Task Management Application using Playwright.

The objective is to verify that critical application workflows operate correctly from the user's perspective before changes are released.

The test suite MUST provide reliable coverage for:

- Authentication and authorization.
- Core application workflows.
- Data creation, retrieval, modification, and deletion.
- Form validation and error handling.
- Navigation and protected routes.
- Desktop and mobile layouts.
- Supported browser compatibility.
- CI/CD release verification.

Playwright tests MUST validate observable application behavior rather than internal implementation details.

---

### Technology and Environment

#### Technology Stack

| Component          | Requirement                                       |
| ------------------ | ------------------------------------------------- |
| Runtime            | Node.js 20.x or a currently supported LTS release |
| Test framework     | `@playwright/test`                                |
| Language           | TypeScript                                        |
| Browser engines    | Chromium, Firefox, WebKit                         |
| Package manager    | Follow the repository's existing package manager  |
| Test execution     | Headless in CI; headed mode available locally     |
| Target environment | Dedicated testing or staging environment          |
| CI/CD              | GitHub Actions or GitLab CI                       |
| Reporting          | Playwright HTML Reporter                          |
| Diagnostics        | Screenshots, traces, and failure videos           |

Use a compatible, pinned Playwright version in the project's package manifest and lockfile. Do not use an unpinned `latest` dependency in CI.

#### Browser Installation

Install the required browser binaries using the Playwright CLI.

```bash
npx playwright install
```

For Linux CI runners, install the required operating-system dependencies as well:

```bash
npx playwright install --with-deps
```

Browser versions MUST remain compatible with the installed Playwright version.

#### Environment Configuration

The test environment MUST be configurable through environment variables.

Required configuration:

```env
BASE_URL=http://localhost:3000
```

Additional configuration MAY include:

```env
API_BASE_URL=http://localhost:5000
E2E_USERNAME=
E2E_PASSWORD=
```

Rules:

- Never hardcode production or staging credentials in test files.
- Never commit secrets to source control.
- Fail clearly when required environment variables are missing.
- Do not silently fall back to production URLs.
- Tests MUST NOT create, modify, or delete production data.
- Use dedicated test accounts and isolated test data.

The base URL MUST be configurable without modifying individual test files.

---

### Test Scope and Classification

Tests MUST be categorized according to their purpose and execution cost.

#### Smoke Tests

Smoke tests verify that the most important application workflows remain functional.

Minimum coverage:

- Application loads successfully.
- User can authenticate.
- Protected routes enforce authentication.
- User can access the primary dashboard.
- User can create and view a core record.
- User can perform an essential update.
- User can log out.

Smoke tests MUST be fast enough to execute on every pull request.

#### Functional Regression Tests

Regression tests verify the complete behavior of supported application features.

Coverage includes:

- Authentication and authorization.
- CRUD operations.
- Form validation.
- Search and filtering.
- Pagination where implemented.
- Navigation.
- Empty states.
- Error states.
- Data persistence.
- Deletion and recovery behavior where supported.

#### Responsive Tests

Core user workflows MUST be tested against desktop and mobile viewport profiles.

| Profile | Viewport   |
| ------- | ---------- |
| Desktop | 1280 × 720 |
| Mobile  | 390 × 844  |

Responsive testing MUST verify functional usability, not only the absence of layout overflow.

#### Cross-Browser Tests

The application MUST support the following browser engines:

- Chromium
- Firefox
- WebKit

Cross-browser tests MUST cover critical user workflows.

The CI pipeline MAY use different browser coverage levels:

- Pull requests: Primary Chromium smoke suite.
- Main/develop integration: Expanded browser coverage.
- Scheduled or pre-release regression: Full browser and responsive matrix.

The required browser matrix MUST be documented in the CI configuration. Browser coverage MUST NOT be silently reduced to satisfy execution-time targets.

#### Out of Scope

The following are handled by separate testing strategies:

- Unit testing of isolated functions.
- Component testing in isolation.
- High-volume load and stress testing.
- Security penetration testing.
- Full accessibility audits.
- Visual regression testing unless separately approved.

E2E tests MAY verify critical accessibility-related user interactions, such as accessible labels and keyboard operation, without replacing a dedicated accessibility testing strategy.

---

### Test Architecture

#### General Principles

Tests MUST:

- Be independent of execution order.
- Verify externally observable behavior.
- Use deterministic test data.
- Avoid unnecessary coupling to application implementation details.
- Support parallel execution.
- Clean up resources created during execution.
- Provide meaningful failure messages.
- Avoid arbitrary delays.
- Be maintainable and reusable.

Do not create abstractions that make tests harder to understand than the behavior they verify.

#### Page Object Model (POM)

Use the Page Object Model for reusable page-level interactions.

Page objects MUST be stored under:

```text
tests/pages/
```

A page object SHOULD encapsulate:

- Page-specific locators.
- Reusable user interactions.
- Navigation relevant to that page.
- Common page-level operations.

Example:

```typescript
import { type Locator, type Page } from "@playwright/test";

export class LoginPage {
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;

  constructor(private readonly page: Page) {
    this.emailInput = page.getByLabel("Email");
    this.passwordInput = page.getByLabel("Password");
    this.loginButton = page.getByRole("button", {
      name: "Sign in",
    });
  }

  async login(email: string, password: string): Promise<void> {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.loginButton.click();
  }
}
```

Rules:

- Use page objects for reusable workflows.
- Do not create a page object for every small component automatically.
- Shared UI components MAY have dedicated component objects.
- Keep scenario-specific assertions in the test when doing so improves readability.
- Page objects MUST NOT hide important test outcomes behind opaque helper methods.
- Avoid exposing implementation details that tests do not need.

#### Locator Strategy

Use locators in this priority order:

**Priority 1: Accessible user-facing locators**

```typescript
page.getByRole();
page.getByLabel();
page.getByPlaceholder();
page.getByText();
```

**Priority 2: Dedicated test IDs**

```typescript
page.getByTestId("card-create-button");
```

**Priority 3: Stable CSS selectors**

CSS selectors MAY be used when semantic locators and test IDs are not practical.

They MUST target stable, intentional attributes rather than DOM structure.

**Prohibited Locator Patterns**

Avoid:

- Fragile positional selectors.
- Deeply nested CSS selectors.
- Generated class names.
- Dynamic framework-specific DOM structures.
- XPath selectors that depend on document layout.
- Arbitrary text matching when multiple elements can match.

Examples of prohibited patterns:

```typescript
page.locator("div > div:nth-child(3) > button");
page.locator("//div[2]/section/button");
```

If a test ID is necessary, use a descriptive, stable name.

Test IDs MUST be added only when they provide meaningful testing value.

#### Assertions

- Use Playwright's `expect` assertions.
- Prefer auto-retrying locator assertions.
- Assert observable outcomes, not arbitrary implementation details.
- Verify important state changes after user actions.
- Avoid assertions that merely confirm an action was clicked.

Example:

```typescript
await loginPage.login("user@example.com", "password");

await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
```

Assertions MUST verify the result that matters to the user.

---

### Test Isolation and Test Data

#### Independent Tests

Every test MUST be independently executable.

A test MUST NOT depend on:

- Another test running first.
- Shared mutable records.
- A previous test's login state unless explicitly provided through a fixture.
- Fixed database IDs.
- Existing test data that is not controlled by the test environment.

#### Test Data Creation

Prefer deterministic API-based setup when available.

Test setup MAY use:

- Dedicated test APIs.
- Playwright API requests.
- Database fixtures managed by the test environment.
- Application UI when setup itself is part of the workflow being tested.

Do not use direct database manipulation as the default way to test user-facing application behavior.

#### Unique Test Data

Tests executing in parallel MUST use isolated data.

Use unique identifiers for generated records.

Example:

```typescript
const uniqueName = `E2E Board ${crypto.randomUUID()}`;
```

Avoid hardcoded shared record names that cause collisions between workers.

#### Cleanup

- Clean up test-created records when appropriate.
- Use reliable teardown mechanisms.
- Ensure cleanup does not remove another test's data.
- Prefer cleanup through a controlled test API or dedicated test fixture.
- Do not allow failed tests to leave uncontrolled shared state.

Where cleanup is not possible, use an isolated environment with a documented data-reset policy.

---

### Authentication and Authorization Testing Standards

#### Authentication State

Use Playwright `storageState` to reuse authenticated sessions where appropriate.

Authentication state SHOULD be generated by a dedicated setup project or fixture.

Example project dependency:

```typescript
projects: [
  {
    name: 'setup',
    testMatch: /.*\.setup\.ts/,
  },
  {
    name: 'chromium',
    dependencies: ['setup'],
    use: {
      ...devices['Desktop Chrome'],
      storageState: 'playwright/.auth/member.json',
    },
  },
],
```

This is an illustrative configuration. The actual setup MUST match the application's authentication mechanism.

Rules:

- Authentication state MUST be stored outside version control.
- Add generated authentication files to `.gitignore`.
- Use separate state files for different roles when necessary.
- Regenerate state when credentials or sessions expire.
- Do not share one mutable account across parallel tests when their operations can interfere.
- Test login and logout directly rather than relying exclusively on stored sessions.

#### Authorization Scenarios

Authentication and authorization MUST be tested separately.

Where the application defines Guest, Member, and Admin roles, verify the approved permission matrix.

Tests SHOULD verify:

- Guests cannot access protected member resources.
- Members cannot access admin-only operations.
- Users cannot access another user's private resources.
- Unauthorized API requests are rejected.
- UI restrictions are consistent with backend authorization.
- Direct navigation does not bypass permission checks.

The backend MUST remain the authoritative source of authorization.

---

### Test Configuration and Execution Standards

The main configuration MUST be maintained in:

```text
playwright.config.ts
```

It MUST define:

- Test directory.
- Test file matching rules.
- Base URL.
- Browser projects.
- Viewport profiles.
- Timeouts.
- Retry policy.
- Worker policy.
- Reporters.
- Screenshot behavior.
- Trace behavior.
- Video behavior.
- CI-specific execution settings.

#### Timeouts

- Define a reasonable test timeout.
- Define a reasonable assertion timeout.
- Prefer Playwright's built-in waiting behavior.
- Avoid increasing global timeouts to conceal slow or unstable tests.
- Use operation-specific timeouts only when justified.

#### Retries

- Local development SHOULD use zero retries by default to expose failures quickly.
- CI MAY use a limited retry count.
- Unexpected retry passes MUST be reported as flaky-test signals.
- Repeated failures MUST NOT be ignored merely because a retry passes.

#### Parallel Execution

- Enable parallel execution where tests are independent.
- Configure worker counts according to available CI resources.
- Ensure data isolation before increasing parallelism.
- Use serial execution only when a genuine dependency cannot reasonably be removed.

#### Prohibited Waiting Patterns

Hardcoded delays MUST NOT be used to synchronize tests.

Prohibited:

```typescript
await page.waitForTimeout(3000);
```

Preferred:

```typescript
await expect(page.getByText("Board created")).toBeVisible();
```

For eventual conditions, use:

- Playwright locator assertions.
- `expect.poll()`.
- `expect().toPass()` for compound retryable assertions where appropriate.
- Explicit network or response waiting when the response itself is the behavior being tested.

Do not wait for arbitrary network idleness when the application has continuous background requests.

---

### Observability and Reporting

#### Screenshots

Capture screenshots automatically on test failure.

```typescript
screenshot: "only-on-failure";
```

#### Trace Viewer

Enable tracing on the first retry.

```typescript
trace: "on-first-retry";
```

#### Video

Retain video recordings only for failed tests.

```typescript
video: "retain-on-failure";
```

#### HTML Reports

Generate Playwright HTML reports.

Requirements:

- Reports MUST include test results and failure information.
- Reports MUST be uploaded as CI artifacts.
- Reports MUST be available even when tests fail.
- Artifact retention MUST follow the repository's CI policy.

#### Failure Diagnostics

Failure output SHOULD identify:

- Test name.
- Browser and viewport.
- Environment.
- Failed assertion.
- Relevant URL.
- Error details.
- Trace and screenshot locations.

Do not expose credentials, access tokens, or sensitive user data in reports.

---

### CI/CD Standards

#### Pull Request Execution

The E2E pipeline MUST execute on pull requests targeting:

- `main`
- `develop`

The pipeline SHOULD run on relevant pushes to these branches as well.

#### Required Pipeline Stages

Recommended execution flow:

1. Install dependencies using the lockfile.
2. Install Playwright browser dependencies.
3. Validate required environment variables.
4. Start or connect to the test application.
5. Prepare isolated test data.
6. Execute the required smoke or regression suite.
7. Generate the HTML report.
8. Upload reports and diagnostics.
9. Return a failing pipeline status when required tests fail.

#### Merge Protection

Required CI checks MUST complete successfully before a pull request is merged.

A failed critical smoke test MUST block the pipeline.

Do not configure CI to report success when required E2E tests have failed.

#### Artifact Retention

- Upload HTML reports after both successful and failed executions when configured.
- Preserve failure traces, screenshots, and videos.
- Set a documented artifact retention period.
- Avoid retaining sensitive test data longer than necessary.

---

## Requirements

### Requirement 1: Authentication and Authorization

**User Story:** As an application user, I want authentication and authorization to be verified end-to-end, so that I can trust the application enforces access controls correctly from the browser through the backend.

#### Acceptance Criteria

1. WHEN a user submits valid credentials, THE E2E_Suite SHALL verify that the user is authenticated and redirected to the protected application.
2. WHEN a user submits invalid credentials, THE E2E_Suite SHALL verify that a clear error message is displayed and access is denied.
3. WHEN a user submits the authentication form with required fields empty, THE E2E_Suite SHALL verify that field validation prevents submission.
4. WHEN an authenticated user clicks logout, THE E2E_Suite SHALL verify that the session is invalidated and the user cannot access protected routes.
5. WHEN an unauthenticated user navigates to a protected route, THE E2E_Suite SHALL verify that the user is redirected to the login page.
6. WHEN an authenticated user attempts to access a resource outside their permissions, THE E2E_Suite SHALL verify that access is denied with an appropriate response.
7. WHEN a user presents an invalid or expired session, THE E2E_Suite SHALL verify that the session is rejected and the user is prompted to authenticate again.

### Requirement 2: Core Application Workflows — Boards

**User Story:** As a task management user, I want board operations to be verified end-to-end, so that I can trust that boards are created, viewed, updated, and deleted correctly through the full application stack.

#### Acceptance Criteria

1. WHEN an authorized user submits a valid board creation form, THE E2E_Suite SHALL verify that the board is created and appears in the board list.
2. WHEN a user navigates to the boards section, THE E2E_Suite SHALL verify that only boards the user is permitted to access are displayed.
3. WHEN an authorized user submits updated board information, THE E2E_Suite SHALL verify that the changes are persisted and reflected in the UI.
4. WHEN an authorized user confirms deletion of a board, THE E2E_Suite SHALL verify that the board is removed according to its defined deletion policy.

### Requirement 3: Core Application Workflows — Columns

**User Story:** As a task management user, I want column operations to be verified end-to-end, so that I can trust that columns are created, renamed, reordered, and deleted correctly.

#### Acceptance Criteria

1. WHEN an authorized user submits a valid column creation form, THE E2E_Suite SHALL verify that the column is created and visible on the board.
2. WHEN an authorized user renames a column, THE E2E_Suite SHALL verify that the new name is persisted and displayed.
3. WHERE column reordering is supported, WHEN a user reorders columns, THE E2E_Suite SHALL verify that the new order is persisted correctly.
4. WHEN an authorized user deletes a column, THE E2E_Suite SHALL verify that the column is removed and cards are handled according to the defined card-retention behavior.

### Requirement 4: Core Application Workflows — Cards

**User Story:** As a task management user, I want card operations to be verified end-to-end, so that I can trust that cards are created, viewed, updated, moved, and deleted correctly.

#### Acceptance Criteria

1. WHEN an authorized user submits a valid card creation form, THE E2E_Suite SHALL verify that the card is created and appears in the correct column.
2. WHEN a user opens a card, THE E2E_Suite SHALL verify that the card details are displayed correctly.
3. WHEN an authorized user updates card information, THE E2E_Suite SHALL verify that the changes are persisted and reflected in the UI.
4. WHEN an authorized user deletes a card, THE E2E_Suite SHALL verify that the card is removed from the board.
5. WHEN an authorized user moves a card to a different column, THE E2E_Suite SHALL verify that the card appears in the target column and is removed from the source column.
6. WHEN a user reorders cards within a column, THE E2E_Suite SHALL verify that the new ordering is persisted correctly after reordering.
7. WHEN a user attempts an invalid card operation, THE E2E_Suite SHALL verify that the operation is rejected and an appropriate error is displayed.

### Requirement 5: Core Application Workflows — Comments

**User Story:** As a task management user, I want comment operations to be verified end-to-end, so that I can trust that comments are added, viewed, edited, and deleted according to the defined permission rules.

#### Acceptance Criteria

1. WHEN an authorized user submits a comment on a card, THE E2E_Suite SHALL verify that the comment is added and displayed on the card.
2. WHEN a user opens a card, THE E2E_Suite SHALL verify that only comments the user is permitted to access are displayed.
3. WHEN a user edits or deletes a comment, THE E2E_Suite SHALL verify that the operation is permitted or denied according to the defined permission rules and that the result is reflected in the UI.

### Requirement 6: Search, Filtering, and Navigation

**User Story:** As a task management user, I want search, filtering, and navigation to be verified end-to-end, so that I can trust that the application routes me correctly and returns accurate results.

#### Acceptance Criteria

1. WHEN a user navigates between application sections, THE E2E_Suite SHALL verify that only sections the user is permitted to access are reachable.
2. WHEN a user performs a search, THE E2E_Suite SHALL verify that only records matching the search query are returned.
3. WHEN a user applies a filter, THE E2E_Suite SHALL verify that only records matching the selected criteria are displayed.
4. WHEN a user applies multiple filters simultaneously, THE E2E_Suite SHALL verify that the results follow the documented combined-filter rules.
5. WHERE pagination is implemented, WHEN a user navigates between pages, THE E2E_Suite SHALL verify that the correct records are displayed for each page.
6. WHEN a search or filter produces no matching records, THE E2E_Suite SHALL verify that an appropriate empty state is displayed.
7. WHEN a user refreshes the page, THE E2E_Suite SHALL verify that persisted data is not unexpectedly lost.

### Requirement 7: Form Validation and Error Handling

**User Story:** As a task management user, I want form validation and error handling to be verified end-to-end, so that I can trust that the application communicates failures clearly and protects me from data loss.

#### Acceptance Criteria

1. WHEN a user submits a form with required fields empty, THE E2E_Suite SHALL verify that the submission is blocked and the missing fields are indicated.
2. WHEN a user submits a form with invalid input formats, THE E2E_Suite SHALL verify that validation errors are displayed clearly.
3. WHEN a user exceeds a maximum field length, THE E2E_Suite SHALL verify that the constraint is enforced and an error is shown.
4. WHEN the backend returns a validation error, THE E2E_Suite SHALL verify that the error is displayed in the UI without exposing internal details.
5. WHEN an API call fails, THE E2E_Suite SHALL verify that the application does not crash and displays an appropriate failure state.
6. WHEN a network failure occurs, THE E2E_Suite SHALL verify that the application displays appropriate feedback to the user.
7. WHEN a form submission fails, THE E2E_Suite SHALL verify that the user's valid input is preserved where possible.
8. WHEN a user initiates a destructive operation, THE E2E_Suite SHALL verify that the defined confirmation behavior is required before the operation proceeds.

### Requirement 8: API Integration and Failure Scenarios

**User Story:** As a quality engineer, I want API integration and failure scenarios to be verified end-to-end, so that I can trust that the frontend handles backend error responses correctly and does not produce misleading success states.

#### Acceptance Criteria

1. WHEN the backend returns an HTTP 400 validation error, THE E2E_Suite SHALL verify that the user-facing error message is displayed correctly.
2. WHEN the backend returns an HTTP 401 unauthenticated response, THE E2E_Suite SHALL verify that the user is redirected to authenticate.
3. WHEN the backend returns an HTTP 403 forbidden response, THE E2E_Suite SHALL verify that access is denied and an appropriate message is shown.
4. WHEN the backend returns an HTTP 404 not-found response, THE E2E_Suite SHALL verify that the application displays an appropriate not-found state.
5. WHEN the backend returns an HTTP 500 server error, THE E2E_Suite SHALL verify that the application displays a safe generic error rather than exposing internal details.
6. WHEN a network request fails, THE E2E_Suite SHALL verify that the application handles the failure gracefully.
7. WHEN a request times out, THE E2E_Suite SHALL verify that the application informs the user and does not remain in an indefinite loading state.
8. IF an API failure occurs during a user operation, THEN THE E2E_Suite SHALL verify that the operation does not produce a misleading success state.

### Requirement 9: Responsive Layouts

**User Story:** As a task management user on a mobile device, I want core workflows to be verified on mobile viewports, so that I can trust the application is usable on smaller screens.

#### Acceptance Criteria

1. WHEN core workflows are executed at the desktop viewport (1280 × 720), THE E2E_Suite SHALL verify that navigation, forms, and controls are accessible and functional.
2. WHEN core workflows are executed at the mobile viewport (390 × 844), THE E2E_Suite SHALL verify that navigation, forms, and controls remain accessible and functional.
3. WHILE the mobile viewport is active, THE E2E_Suite SHALL verify that dialogs and menus fit within the viewport without critical actions becoming inaccessible.
4. WHILE the mobile viewport is active, THE E2E_Suite SHALL verify that content does not become inaccessible due to overflow.

### Requirement 10: Cross-Browser Compatibility

**User Story:** As a quality engineer, I want critical workflows to be verified across all supported browser engines, so that I can trust the application behaves consistently for users on different browsers.

#### Acceptance Criteria

1. WHEN critical workflows are executed on Chromium, THE E2E_Suite SHALL verify that the workflows complete successfully.
2. WHEN critical workflows are executed on Firefox, THE E2E_Suite SHALL verify that the workflows complete successfully.
3. WHEN critical workflows are executed on WebKit, THE E2E_Suite SHALL verify that the workflows complete successfully.
4. IF a browser-specific failure is detected, THEN THE E2E_Suite SHALL report the failure rather than silently skipping the browser.

### Requirement 11: Smoke Test Execution Time

**User Story:** As a CI/CD pipeline operator, I want the focused smoke suite to complete quickly, so that pull requests receive fast feedback without blocking the development workflow.

#### Acceptance Criteria

1. WHILE running in CI, THE Smoke_Suite SHALL complete within three minutes on a standard CI runner.
2. WHEN the smoke suite is triggered by a pull request, THE CI_Pipeline SHALL execute the Chromium smoke suite as the minimum required check.
3. IF the smoke suite exceeds the time budget, THEN THE CI_Pipeline SHALL report the timeout as a test failure rather than silently passing.

### Requirement 12: CI/CD Pipeline Integration

**User Story:** As a CI/CD pipeline operator, I want E2E tests to be integrated into the CI pipeline, so that failing tests block merges and test artifacts are preserved for diagnosis.

#### Acceptance Criteria

1. WHEN a pull request targets `main` or `develop`, THE CI_Pipeline SHALL execute the required E2E smoke suite.
2. WHEN any required E2E test fails, THE CI_Pipeline SHALL return a failing status and block the pull request from merging.
3. WHEN tests complete, THE CI_Pipeline SHALL generate and upload an HTML report regardless of whether tests passed or failed.
4. WHEN a test fails, THE CI_Pipeline SHALL preserve screenshots, traces, and video recordings as CI artifacts.
5. THE CI_Pipeline SHALL NOT report a passing status when required E2E tests have failed.

---

## Glossary

- **E2E_Suite**: The Playwright end-to-end test suite that executes browser-based tests against the full application stack.
- **Smoke_Suite**: The focused subset of E2E tests that verify the most critical application workflows and are designed to run on every pull request within a strict time budget.
- **CI_Pipeline**: The automated continuous integration pipeline (GitHub Actions or GitLab CI) that executes tests, generates reports, and enforces quality gates.
- **Page Object Model (POM)**: A test design pattern that encapsulates page-specific locators and interactions into reusable class-based objects.
- **storageState**: A Playwright mechanism for persisting and reusing browser authentication state (cookies, local storage) across tests to avoid repeated login flows.
- **Locator**: A Playwright API for finding elements on a page, with built-in auto-retry and auto-wait behavior.
- **Trace Viewer**: A Playwright diagnostic tool that records a full execution trace (actions, screenshots, network) for replaying failed tests.
- **Chromium**: The open-source browser engine underlying Google Chrome, used as the primary browser target for Playwright tests.
- **WebKit**: The browser engine underlying Safari, tested via Playwright to ensure compatibility for Apple platform users.
- **Firefox**: The Mozilla browser engine, tested via Playwright to verify cross-browser compatibility.
- **BASE_URL**: The environment variable that defines the target application URL for Playwright tests, ensuring tests do not hardcode environment-specific addresses.
- **Test Fixture**: A reusable setup and teardown mechanism in Playwright that provides tests with pre-configured state such as authenticated users or pre-created test data.
- **IDOR (Insecure Direct Object Reference)**: A class of authorization vulnerability where a user accesses another user's resource by manipulating an identifier — E2E authorization tests SHOULD include scenarios that verify this is prevented.
- **storageState file**: The JSON file generated by Playwright containing serialized browser session data, stored outside version control under `playwright/.auth/`.
