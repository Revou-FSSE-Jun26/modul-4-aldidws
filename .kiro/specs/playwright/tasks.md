# Implementation Plan: Playwright E2E Test Suite

## Overview

Expand the existing Playwright suite from the two-file auth foundation (`auth.setup.ts` + `auth.spec.ts`) to full functional regression coverage. The work proceeds in four layers: infrastructure, shared utilities and fixtures, page objects, and test specs. Infrastructure and utilities must land before specs; page objects and utilities can be built in parallel once the fixture contract is defined.

## Tasks

- [ ] 1. Extend infrastructure configuration
  - [ ] 1.1 Update `playwright.config.ts` to add firefox, webkit, and mobile-chromium projects; set `screenshot: "only-on-failure"` and `video: "retain-on-failure"`; read `baseURL` from `process.env.BASE_URL` with fallback to `http://localhost:3000`
    - Modify `frontend/playwright.config.ts`
    - Add three new project entries (`firefox`, `webkit`, `mobile-chromium`) each depending on `setup` and loading `playwright/.auth/user.json`
    - Add `screenshot` and `video` to the top-level `use` block
    - Change hardcoded `baseURL` to `process.env.BASE_URL ?? "http://localhost:3000"`
    - _Requirements: §9 (Test Configuration), §8 (Responsive and Cross-Browser), §2.3 (Environment Configuration)_
  - [ ] 1.2 Create `frontend/.env.example` with all test environment variables
    - Create `frontend/.env.example` (or append to it if it already exists)
    - Add entries: `BASE_URL`, `API_BASE_URL`, `NEXT_PUBLIC_API_BASE_URL`, `TEST_USER_EMAIL`, `TEST_USER_PASSWORD`
    - Use only placeholder values — no real credentials
    - _Requirements: §2.3 (Environment Configuration)_

- [ ] 2. Create shared test utilities
  - [ ] 2.1 Create `frontend/tests/utils/data.ts` with unique name generators
    - Export `uniqueBoardName()`, `uniqueColumnName()`, `uniqueCardTitle()`, `uniqueComment()` — each appends a short `randomUUID()` fragment
    - _Requirements: §5.3 (Unique Test Data)_
  - [ ] 2.2 Create `frontend/tests/utils/api.ts` with typed Flask API wrappers
    - Export interfaces: `Board`, `Column`, `Card`, `Comment`
    - Export functions: `createBoard`, `deleteBoard`, `createColumn`, `deleteColumn`, `createCard`, `deleteCard`, `createComment`
    - Each function accepts an `APIRequestContext` and unwraps the `{ data: T }` envelope
    - _Requirements: §5.2 (Test Data Creation), §4.1 (General Principles)_

- [ ] 3. Create custom test fixtures
  - [ ] 3.1 Create `frontend/tests/fixtures/index.ts` extending Playwright's base `test`
    - Export `test` with two fixtures: `authedRequest` (logs in via POST `/api/auth/login` and returns an authenticated `APIRequestContext`) and `testData` (wraps the name generators from `utils/data.ts`)
    - Export `expect` re-exported from `@playwright/test`
    - _Requirements: §5.1 (Independent Tests), §6.1 (Authentication State)_

- [ ] 4. Create Page Object Model files
  - [ ] 4.1 Create `frontend/tests/pages/LoginPage.ts`
    - Locators: `emailInput` (`getByLabel("Email")`), `passwordInput` (`getByLabel("Password")`), `signInButton` (`getByRole("button", { name: /sign in/i })`), `errorMessage` (`getByTestId("login-error")`)
    - Methods: `goto()`, `login(email, password)`
    - _Requirements: §4.2 (Page Object Model), FR-01_
  - [ ] 4.2 Create `frontend/tests/pages/HomePage.ts`
    - Locators: `boardsList` (`getByRole("list", { name: /boards/i })`), `emptyState` (`getByText(/you don't have any boards yet/i)`)
    - Methods: `goto()`, `boardLink(name)`, `boardCard(name)`
    - _Requirements: §4.2 (Page Object Model), FR-02.1, FR-02.2_
  - [ ] 4.3 Create `frontend/tests/pages/BoardDetailPage.ts`
    - Locators: `heading` (h1), `columnList`, `emptyBoardMessage`
    - Methods: `goto(boardId)`, `column(name)`, `cardInColumn(columnName, cardTitle)`, `addCardButton(columnName)`, `cardTitleInput()`, `addCardSubmitButton()`, `columnRenameInput()`, `deleteColumnButton(name)`, `deleteCardButton(title)`
    - All locators must match the actual ARIA roles and labels used in `app/boards/[id]/page.tsx`
    - _Requirements: §4.2 (Page Object Model), FR-02.5–FR-02.15_
  - [ ] 4.4 Create `frontend/tests/pages/CardDetailModalObject.ts`
    - Locators: `dialog` (`getByRole("dialog")`), `closeButton`, `commentTextarea` (`getByLabel("Add a comment")`), `postCommentButton`, `commentError` (`#comment-body-error`), `commentsSection` (`getByRole("region", { name: /comments/i })`)
    - Methods: `close()`, `postComment(body)`, `commentBody(text)`
    - _Requirements: §4.2 (Page Object Model), FR-02.10, FR-02.16–FR-02.18_

- [ ] 5. Annotate existing auth tests with @smoke tag
  - [ ] 5.1 Add `@smoke` annotation to all four tests in `frontend/tests/auth.spec.ts`
    - Annotate each `test(...)` call with `{ tag: "@smoke" }` or use `test.describe` with the tag so they appear in `--grep "@smoke"` runs
    - Do not change any test logic or locators
    - _Requirements: §3.1 (Smoke Tests), FR-01_

- [ ] 6. Create board E2E tests
  - [ ] 6.1 Create `frontend/tests/e2e/boards/boards.spec.ts`
    - Import `test`, `expect` from `fixtures/index.ts` and page objects
    - `beforeEach`/`afterEach` pattern: create board via `authedRequest`, delete board in teardown
    - Test cases:
      - `@smoke` — created board appears in home page board list (FR-02.2)
      - `@smoke` — clicking a board card navigates to `/boards/<id>` and shows board heading (FR-02.1)
      - `@smoke` — board detail page renders board name in `<h1>` (FR-02.1)
      - Update board name via UI and verify heading changes (FR-02.3)
      - Delete board via UI and verify it no longer appears in board list (FR-02.4)
    - _Requirements: FR-02.1–FR-02.4, §3.1 (Smoke Tests)_

- [ ] 7. Create column E2E tests
  - [ ] 7.1 Create `frontend/tests/e2e/columns/columns.spec.ts`
    - Setup: create a board (and tear it down) per describe block
    - Test cases:
      - Authorized user can create a column via UI; column heading appears in board detail (FR-02.5)
      - User can rename a column; updated name appears in heading (FR-02.6)
      - User can reorder columns if the UI supports it; order reflects after reload (FR-02.7)
      - User can delete a column; column no longer appears (FR-02.8)
      - Deleting a column with cards follows the defined card-retention behavior (FR-02.8)
    - _Requirements: FR-02.5–FR-02.8_

- [ ] 8. Create card E2E tests
  - [ ] 8.1 Create `frontend/tests/e2e/cards/cards.spec.ts`
    - Setup: create a board + column per describe block; create cards as needed per test; delete board in teardown
    - Test cases:
      - `@smoke` — authorized user can create a card; card title appears in column (FR-02.9)
      - `@smoke` — clicking a card opens the detail modal/view showing title (FR-02.10)
      - User can update card information; updated title appears (FR-02.11)
      - User can delete a card; card no longer appears in column (FR-02.12)
      - User can move a card to a different column; card appears in target column (FR-02.13)
      - Card order remains correct after reordering (FR-02.14)
      - Submitting a card with a blank title shows a required-field error (FR-02.15, FR-04.1)
      - Submitting a card title over 255 characters triggers length validation (FR-02.15, FR-04.3)
    - _Requirements: FR-02.9–FR-02.15, FR-04.1, FR-04.3, §3.1 (Smoke Tests)_

- [ ] 9. Create comment E2E tests
  - [ ] 9.1 Create `frontend/tests/e2e/comments/comments.spec.ts`
    - Setup: create a board + column + card per describe block; delete board in teardown
    - Test cases:
      - Authorized user can add a comment; comment body appears in card detail (FR-02.16)
      - Comments section shows all comments the user is permitted to view (FR-02.17)
      - User can edit their own comment; updated text appears (FR-02.18)
      - User can delete their own comment; comment no longer appears (FR-02.18)
      - Submitting an empty comment shows the "Comment cannot be empty." alert (FR-04.1)
    - _Requirements: FR-02.16–FR-02.18, FR-04.1_

- [ ] 10. Create navigation E2E tests
  - [ ] 10.1 Create `frontend/tests/e2e/navigation/navigation.spec.ts`
    - Test cases:
      - `@smoke` — authenticated user navigates from home page to board detail via board card link (FR-03.1)
      - `@smoke` — navigating to `/boards/<nonexistent-uuid>` renders the not-found boundary (FR-04.5, §7 Error Handling)
      - Home page shows empty state text when user has no boards (FR-03.6)
      - Board detail shows "no columns yet" message for a board without columns (FR-03.6)
      - Refreshing the board detail page retains the correct board (FR-03.7)
    - _Requirements: FR-03.1, FR-03.6, FR-03.7, FR-04.5, §3.1 (Smoke Tests)_

- [ ] 11. Create responsive E2E tests
  - [ ] 11.1 Create `frontend/tests/e2e/responsive/responsive.spec.ts`
    - Use `test.use({ project: "mobile-chromium" })` or scope these tests to only the `mobile-chromium` project
    - Test cases on a 390×844 viewport:
      - Login form is fully accessible and submittable (FR-01.1)
      - Home page board list is scrollable and board cards are reachable (FR-02.2)
      - Board detail columns are horizontally scrollable and column headings are visible (FR-02.1)
      - Navigation controls remain usable (FR-03.1)
      - Create-card form is accessible (FR-02.9)
    - _Requirements: §8.1 (Responsive Coverage), FR-01.1, FR-02.1, FR-02.2, FR-02.9, FR-03.1_

- [ ] 12. Create API error scenario tests
  - [ ] 12.1 Create `frontend/tests/e2e/errors/errors.spec.ts`
    - Use `page.route()` to intercept and mock specific API responses
    - Test cases:
      - Mocked 500 on `GET /api/boards` renders inline error message on home page (FR-04.5, FR-05)
      - Mocked 500 on `GET /api/boards/<id>` renders inline error message on board detail (FR-04.5, FR-05)
      - Mocked 404 on board detail navigates to not-found boundary (FR-04.5, FR-05)
      - Mocked network failure (route abort) on boards endpoint shows user-facing feedback (FR-04.6, FR-05)
      - Verify that failed operations do not produce misleading success states (FR-04.5)
    - _Requirements: FR-04.5, FR-04.6, FR-05, §11 (API Mocking Strategy from testing.md)_

- [ ] 13. Update CI workflow
  - [ ] 13.1 Update `.github/workflows/playwright.yml` to split into smoke and regression jobs
    - Replace the single `test` job with two jobs: `smoke` (runs on `pull_request`, Chromium only, `--grep "@smoke"`, installs only Chromium browser) and `regression` (runs on `push` to `main`/`develop`, all browser projects, full suite)
    - Add `working-directory: frontend` to both jobs
    - Add `cache: npm` with `cache-dependency-path: frontend/package-lock.json` to `actions/setup-node@v4`
    - Pass `TEST_USER_EMAIL` and `TEST_USER_PASSWORD` secrets and `BASE_URL`/`API_BASE_URL` vars to both jobs
    - Upload HTML reports as artifacts (`playwright-smoke-report` for 14 days, `playwright-regression-report` for 30 days) using `if: ${{ !cancelled() }}`
    - _Requirements: §11 (CI/CD Requirements), §11.2 (Required Pipeline Stages), §11.3 (Merge Protection)_

- [ ] 14. Final checkpoint — ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Tasks 2.1 and 2.2 (utilities) can be built in parallel
- Tasks 4.1, 4.2, 4.3, and 4.4 (page objects) can be built in parallel once task 3.1 (fixtures) is done
- Tasks 6.1, 7.1, 8.1, 9.1, 10.1, 11.1, and 12.1 (spec files) can all be built in parallel once tasks 3.1 and 4.1–4.4 are done
- Task 13.1 (CI) is independent of all test spec tasks and can be done at any point
- No property-based test tasks are included — the design document explicitly omits a Correctness Properties section because all acceptance criteria are example-based integration tests that require a real browser
- Each `@smoke`-tagged test must remain fast enough for the full smoke suite to complete within three minutes
- All test specs must import `test` and `expect` from `fixtures/index.ts`, not directly from `@playwright/test`
- Never use `page.waitForTimeout()` — use Playwright's auto-retrying locator assertions throughout

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "2.1", "2.2", "13.1"] },
    { "id": 1, "tasks": ["3.1"] },
    { "id": 2, "tasks": ["4.1", "4.2", "4.3", "4.4", "5.1"] },
    { "id": 3, "tasks": ["6.1", "7.1", "8.1", "9.1", "10.1", "11.1", "12.1"] }
  ]
}
```
