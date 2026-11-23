---
inclusion: fileMatch
fileMatchPattern: "{app,components,features,hooks,lib}/**/*"
---

# Frontend Engineering Standards

## 1. Core Engineering Principles

### 1.1 Follow the Existing Architecture

- MUST inspect the existing project structure before creating or modifying files.
- MUST follow established architectural patterns unless there is a documented reason to change them.
- MUST reuse existing components, hooks, utilities, types, and services when appropriate.
- MUST avoid introducing duplicate implementations of existing functionality.
- MUST NOT restructure unrelated parts of the application without explicit justification.

### 1.2 Prefer Simplicity

- MUST prefer simple, maintainable implementations over unnecessary abstractions.
- MUST avoid premature optimization and overengineering.
- MUST introduce abstractions when they provide meaningful reuse, separation of concerns, or testability.
- MUST NOT create unnecessary wrapper components, hooks, providers, or utility functions.
- SHOULD favor composition over deeply nested component hierarchies.

### 1.3 Type Safety

- MUST use TypeScript for application code.
- MUST NOT use `any` unless absolutely necessary and explicitly justified.
- MUST prefer `unknown` over `any` when the data type is not known.
- MUST define explicit types for API contracts and important domain models.
- MUST handle nullable and optional values explicitly.
- MUST NOT suppress TypeScript errors using `@ts-ignore` without documented justification.

---

## 2. Component Architecture

### 2.1 Server Components by Default

- MUST use React Server Components by default.
- MUST NOT add `"use client"` unless client-side capabilities are required.
- SHOULD use Server Components for:
  - Initial data retrieval.
  - Static and data-driven rendering.
  - Server-side authentication checks.
  - Accessing server-only resources.
- MUST keep server-only credentials and secrets out of client bundles.
- MUST NOT import server-only modules into Client Components.

### 2.2 Client Component Boundaries

A component MUST use `"use client"` when it requires:

- React client-side state or lifecycle hooks.
- Browser APIs.
- Interactive event handlers.
- Client-side context consumption.
- Client-side effects.

Additional rules:

- MUST keep Client Components as close as possible to the interactive UI boundary.
- SHOULD isolate interactive elements into smaller Client Components.
- MUST NOT convert an entire page or layout into a Client Component when only a small section requires interactivity.
- MUST ensure props crossing the Server-to-Client boundary are serializable, except for explicitly supported Server Action patterns.
- MUST NOT pass ordinary server-defined callback functions into Client Components.

### 2.3 Single Responsibility

- MUST give each component one clear primary responsibility.
- MUST separate rendering, data access, and business logic.
- MUST extract reusable stateful React behavior into custom hooks.
- MUST place API communication in service or API modules rather than embedding HTTP logic throughout UI components.
- MUST keep complex business logic outside presentation components.
- SHOULD keep components small enough to understand and test independently.

### 2.4 Component Props

- MUST define explicit TypeScript contracts for exported components with meaningful props.
- SHOULD use `interface` for extensible object-shaped props.
- MAY use `type` for unions, intersections, and composed types.
- MUST use descriptive prop names.
- MUST define callback props using `on<Event>` naming.
- MUST use `children` only when component composition requires it.
- MUST avoid redundant interfaces for components that do not accept props.

Example:

```tsx
interface TaskCardProps {
  task: Task;
  onTaskSelect: (taskId: string) => void;
  isSelected?: boolean;
}

export function TaskCard({
  task,
  onTaskSelect,
  isSelected = false,
}: TaskCardProps) {
  return (
    <button
      type="button"
      aria-pressed={isSelected}
      onClick={() => onTaskSelect(task.id)}
    >
      {task.title}
    </button>
  );
}
```

### 2.5 Component Composition

- MUST prefer composition over components with excessive configuration props.
- SHOULD extract repeated UI patterns into reusable components.
- MUST keep domain-specific components within their respective feature boundaries.
- MUST place genuinely shared UI primitives in `components/shared/`.
- MUST avoid creating generic components for one-off use cases without a clear reuse requirement.

---

## 3. Folder Structure

### 3.1 Feature-Oriented Organization

- MUST organize substantial business features under `features/<feature-name>/`.
- MUST keep feature-specific components, hooks, services, schemas, and types close to their respective features.
- MUST place reusable application-wide components in `components/shared/`.
- MUST place application-wide utilities and infrastructure in `lib/`.
- MUST place App Router route entry files inside `app/`.

Recommended structure:

```text
src/
├── app/
│   ├── (auth)/
│   ├── (dashboard)/
│   ├── layout.tsx
│   ├── loading.tsx
│   ├── error.tsx
│   └── not-found.tsx
│
├── components/
│   ├── shared/
│   ├── layout/
│   └── providers/
│
├── features/
│   ├── auth/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── schemas/
│   │   └── types/
│   ├── boards/
│   ├── tasks/
│   └── notifications/
│
├── hooks/
├── lib/
│   ├── api/
│   ├── auth/
│   ├── utils/
│   └── constants/
│
└── types/
```

This structure is a guideline, not a requirement to create empty directories.

### 3.2 Dependency Boundaries

- MUST NOT allow shared UI components to depend on feature-specific business logic.
- MUST NOT create circular imports between features.
- SHOULD keep feature dependencies explicit.
- SHOULD expose reusable feature functionality through clear module exports.
- MUST NOT place backend-only database or infrastructure logic in the frontend.

---

## 4. Naming Conventions

### 4.1 Component Files

- MUST use `PascalCase` for React component files.
- MUST use the `.tsx` extension for files containing JSX.

Examples:

- `TaskCard.tsx`
- `BoardHeader.tsx`
- `NotificationBell.tsx`

### 4.2 Custom Hook Files

- MUST use `camelCase`.
- MUST begin with the `use` prefix.
- MUST use the `.ts` extension unless JSX is required.

Examples:

- `useAuth.ts`
- `useNotifications.ts`
- `useDragAndDrop.ts`

### 4.3 Functions and Variables

- MUST use `camelCase` for functions and variables.
- MUST use descriptive names that communicate intent.
- SHOULD use verbs for action-oriented functions.

Examples:

- `fetchTasks`
- `createTask`
- `handleTaskDelete`
- `isSubmitting`

### 4.4 Constants

- SHOULD use `UPPER_SNAKE_CASE` for application-wide immutable constants.

Examples:

- `API_BASE_URL`
- `MAX_TASK_TITLE_LENGTH`
- `DEFAULT_PAGE_SIZE`

- MUST NOT use constants for values that are better represented as local variables.

### 4.5 Event Handlers

- MUST use `on<Event>` for callback props.
- SHOULD use `handle<Event>` for local event handler functions.

Example:

```tsx
interface AddTaskFormProps {
  onTaskCreate: (title: string) => void;
}

function AddTaskForm({ onTaskCreate }: AddTaskFormProps) {
  function handleSubmit() {
    onTaskCreate("New task");
  }

  return (
    <button type="button" onClick={handleSubmit}>
      Add Task
    </button>
  );
}
```

### 4.6 Boolean Naming

- MUST use descriptive boolean names.
- SHOULD use affirmative names that clearly communicate state.
- MAY use prefixes such as `is`, `has`, `can`, and `should`.
- MAY use established HTML and React conventions such as `disabled`, `required`, `selected`, and `open`.

Examples:

- `isLoading`
- `hasError`
- `canEdit`
- `shouldRefresh`
- `disabled`

### 4.7 Next.js App Router Files

- MUST use the reserved Next.js filenames for route conventions.

Examples:

- `page.tsx`
- `layout.tsx`
- `loading.tsx`
- `error.tsx`
- `not-found.tsx`
- `route.ts`

- SHOULD use descriptive named exports for page components.

Example:

```tsx
export default function BoardDetailPage() {
  return <main>Board Details</main>;
}
```

- MUST NOT rename reserved Next.js route files to PascalCase.

### 4.8 Shared UI Components

- SHOULD use a `Base` prefix for generic shared primitives when consistent with the existing project convention.

Examples:

- `BaseButton.tsx`
- `BaseModal.tsx`
- `BaseInput.tsx`

- MUST NOT apply the `Base` prefix to domain-specific components.

Examples:

- `TaskCard.tsx`
- `BoardColumn.tsx`

---

## 5. Styling Standards

### 5.1 Tailwind CSS as the Default

- MUST use Tailwind CSS utilities for standard component styling.
- MUST NOT introduce separate CSS files for individual components without a justified need.
- MAY use CSS modules or global CSS for complex styling that cannot be reasonably expressed through Tailwind.
- MUST avoid duplicated styling definitions.

### 5.2 Inline Styles

- MUST prefer Tailwind utilities over inline styles.
- SHOULD avoid `style={{}}` for static visual properties.
- MAY use inline styles for genuinely dynamic runtime values when Tailwind utilities are insufficient.
- SHOULD use CSS custom properties for dynamic values when appropriate.

### 5.3 Design Tokens

- MUST use centralized semantic design tokens for recurring colors, typography, spacing, and surfaces.
- MUST NOT hardcode application-wide brand colors independently across components.
- SHOULD use semantic roles instead of color-specific implementation choices.

Examples:

```tsx
<button className="bg-primary text-primary-foreground hover:bg-primary/90">
  Save
</button>

<div className="bg-background text-foreground border-border">
  Content
</div>
```

The actual token definitions SHALL be maintained centrally in the project's theme configuration or CSS variables.

### 5.4 Spacing and Sizing

- SHOULD prefer Tailwind's standard spacing and sizing scale.
- MUST avoid arbitrary values when an existing design token provides the same result.
- MAY use arbitrary values when a legitimate design requirement cannot be represented by existing tokens.
- MUST avoid unexplained hardcoded pixel values.
- SHOULD reuse shared layout patterns.

### 5.5 Responsive Design

- MUST follow a mobile-first styling approach.
- MUST ensure layouts work on mobile, tablet, and desktop.
- MUST prevent unintended horizontal overflow.
- SHOULD use responsive Tailwind breakpoints consistently.

Example:

```tsx
<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
  {children}
</div>
```

### 5.6 Tailwind Class Ordering

- SHOULD organize utility classes consistently:
  1. Layout and display.
  2. Positioning.
  3. Sizing.
  4. Spacing.
  5. Typography.
  6. Background and borders.
  7. Effects.
  8. Interactive states.
  9. Responsive variants.

- SHOULD use the project's configured formatting tools rather than manually reorganizing every class.

### 5.7 Shared Primitive Styling

- MUST centralize recurring base styles for shared primitives.
- SHOULD support appropriate variants for reusable buttons, inputs, badges, and modals.
- MUST avoid duplicating long class strings throughout the application.

---

## 6. State Management

### 6.1 Local Component State

- MUST use local React state for temporary component-specific UI state.
- SHOULD use `useState` for simple state.
- MAY use `useReducer` when state transitions are sufficiently complex.

Examples:

- Modal visibility.
- Form input values.
- Dropdown state.
- Temporary selection.
- Local loading indicators.

### 6.2 Server State

- MUST treat the backend as the authoritative source of persistent application data.
- SHOULD use Server Components for initial data retrieval when appropriate.
- MUST NOT treat browser local storage as the primary database.
- MUST keep API response data synchronized after successful mutations.
- SHOULD use appropriate Next.js cache invalidation mechanisms for cached server data.
- MUST handle loading, success, empty, and error states.
- SHOULD avoid unnecessary duplicate API requests.

### 6.3 Global Client State

- MUST use React Context for genuinely cross-component client state when appropriate.
- SHOULD keep Context providers narrowly scoped.
- MUST NOT use global state for data that can be obtained directly through Server Components.
- MUST NOT introduce third-party state management libraries without a demonstrated architectural need.

### 6.4 Authentication State

- MUST use a centralized authentication strategy.
- MUST distinguish authenticated identity from credential storage.
- MUST NOT store sensitive authentication tokens in `localStorage` or `sessionStorage`.
- MUST NOT assume that React Context provides security.
- SHOULD use appropriately configured `HttpOnly`, `Secure`, and `SameSite` cookies for authentication credentials.
- MUST perform protected resource authorization on the backend.
- MUST ensure server-side route protection is implemented where required.
- MUST handle expired sessions and authentication failures consistently.

### 6.5 Optimistic Updates

- MAY use optimistic updates when they improve user experience.
- MUST implement rollback or reconciliation when an optimistic mutation fails.
- MUST NOT display permanent success before the backend confirms persistence.
- SHOULD use optimistic updates only when consistency and failure recovery are clearly defined.

---

## 7. API Integration and Data Access

### 7.1 Centralized API Communication

- MUST centralize reusable HTTP communication in API clients or service modules.
- MUST NOT duplicate request configuration throughout components.
- MUST define explicit TypeScript request and response contracts.
- MUST handle network failures and unexpected response structures.
- MUST use environment variables for configurable API endpoints.

### 7.2 API Responsibilities

- MUST keep presentation components independent of raw HTTP implementation details.
- SHOULD organize API services by domain.

Example:

```text
features/
└── tasks/
    └── services/
        └── taskService.ts
```

Example:

```ts
export async function fetchTasks(): Promise<Task[]> {
  const response = await fetch("/api/v1/tasks");

  if (!response.ok) {
    throw new Error("Failed to retrieve tasks");
  }

  return response.json();
}
```

### 7.3 Server-Side and Client-Side Requests

- SHOULD perform initial authenticated data retrieval on the server when appropriate.
- MUST ensure authentication credentials are handled securely during server-side requests.
- MUST NOT expose private backend URLs or secrets to browser code unnecessarily.
- SHOULD use a server-side proxy or Backend-for-Frontend layer when needed to safely integrate the frontend with the backend.
- MUST NOT assume that server-side fetch caching and client-side fetch caching behave identically.
- MUST explicitly define cache behavior for authenticated and user-specific data.
- MUST prevent one user's cached data from being served to another user.

### 7.4 Mutations

- MUST validate user input before submission.
- MUST display an appropriate pending state during mutations.
- MUST prevent unintended duplicate submissions.
- MUST handle failed requests without losing user input.
- MUST update or invalidate affected server data after successful mutations.
- SHOULD use Server Actions only when they fit the application architecture and backend integration.
- MUST NOT bypass the backend's business rules through frontend-only validation.

---

## 8. Forms and Validation

### 8.1 Form Implementation

- MUST use controlled or appropriately managed form inputs.
- MUST associate form fields with accessible labels.
- MUST display validation errors close to the relevant fields.
- MUST disable or otherwise prevent duplicate submission while an operation is pending.
- MUST preserve user input when submission fails.

### 8.2 Validation

- MUST validate user input on the backend.
- MUST implement frontend validation for immediate user feedback.
- SHOULD use shared validation schemas when practical.
- MUST validate required fields, maximum lengths, data formats, and allowed values.
- MUST NOT rely exclusively on HTML input validation.
- MUST NOT trust data received from the browser.

### 8.3 Submission Feedback

- MUST provide clear loading and success states.
- MUST display actionable error messages.
- MUST prevent misleading success indicators when persistence fails.
- SHOULD return focus to an appropriate field when validation fails.

---

## 9. Error Handling and Loading States

### 9.1 Error Handling

- MUST handle expected errors explicitly.
- MUST NOT silently swallow exceptions.
- MUST NOT expose stack traces, internal server details, or sensitive information to users.
- MUST display user-friendly error messages.
- SHOULD log unexpected errors through the application's established logging or monitoring system.

### 9.2 Next.js Error Boundaries

- SHOULD use `error.tsx` for route-level error recovery.
- SHOULD use `global-error.tsx` for root-level error handling when needed.
- SHOULD use `not-found.tsx` for missing resources.
- MUST provide a recovery action when an error boundary can reasonably recover.

### 9.3 Loading States

- SHOULD use `loading.tsx` for route-level loading experiences.
- SHOULD use React Suspense for independently loading UI sections.
- MUST prevent undefined or incomplete data from being rendered as valid content.
- SHOULD provide skeletons or appropriate progress indicators when they improve perceived performance.

### 9.4 Empty States

- MUST distinguish between:
  - No data exists.
  - No results match the active filters.
  - Data is still loading.
  - Data retrieval failed.

- SHOULD provide an actionable next step when appropriate.

---

## 10. Accessibility

### 10.1 Semantic HTML

- MUST use semantic HTML elements.
- MUST use buttons for actions and links for navigation.
- MUST provide accessible names for interactive elements.
- MUST associate labels with form controls.

### 10.2 Keyboard Navigation

- MUST ensure interactive elements are keyboard accessible.
- MUST provide visible focus indicators.
- MUST support logical focus order.
- MUST manage focus appropriately in dialogs and modals.
- MUST NOT rely exclusively on hover interactions.

### 10.3 Screen Readers

- MUST provide meaningful alternative text for informative images.
- MUST use appropriate ARIA attributes when native HTML semantics are insufficient.
- MUST announce important asynchronous feedback when appropriate.
- MUST ensure icon-only buttons have accessible labels.

### 10.4 Visual Accessibility

- SHOULD target WCAG 2.2 AA.
- MUST maintain appropriate text contrast.
- MUST NOT use color as the only indicator of status or priority.
- SHOULD respect reduced-motion preferences.
- MUST support usable layouts at common browser zoom levels.

### 10.5 Interactive Components

- MUST ensure dropdowns, dialogs, menus, tabs, and other interactive components have appropriate keyboard and focus behavior.
- MUST ensure drag-and-drop interactions have an accessible alternative where applicable.

---

## 11. Performance Optimization

### 11.1 Rendering

- SHOULD keep static content in Server Components.
- MUST avoid unnecessary Client Component boundaries.
- MUST avoid unnecessary state updates and re-renders.
- SHOULD use memoization only when profiling or component complexity justifies it.
- MUST NOT add `useMemo`, `useCallback`, or `React.memo` indiscriminately.

### 11.2 Code Splitting

- SHOULD use dynamic imports for large, non-critical client-side features.
- SHOULD lazy-load expensive components when appropriate.
- MUST avoid loading unnecessary dependencies on initial page render.

### 11.3 Images and Media

- SHOULD use `next/image` for optimized images when applicable.
- MUST provide appropriate dimensions or aspect ratios to prevent layout shifts.
- SHOULD use suitable image formats and sizes.
- MUST provide alternative text where appropriate.
- MUST NOT use lazy loading for critical above-the-fold images when eager loading is more appropriate.

### 11.4 Data Fetching

- MUST avoid unnecessary repeated requests.
- SHOULD fetch data at the highest appropriate shared component boundary.
- MUST define caching behavior explicitly.
- MUST use pagination or incremental loading for large datasets.
- SHOULD avoid fetching data that is not required by the current view.

---

## 12. Next.js App Router Standards

### 12.1 Routing

- MUST use the Next.js App Router conventions.
- MUST use `next/link` for internal navigation.
- MUST use `next/navigation` APIs for programmatic navigation.
- MUST avoid unnecessary full-page browser reloads.

### 12.2 Layouts

- SHOULD use shared layouts for persistent application structure.
- MUST avoid duplicating headers, navigation, and shared page structure.
- SHOULD keep global providers at the narrowest appropriate layout boundary.

### 12.3 Metadata

- MUST define appropriate page metadata for public pages.
- SHOULD use `generateMetadata` for dynamic route metadata.
- MUST avoid exposing private user information in metadata.

### 12.4 Route States

- SHOULD implement route-specific loading and error handling where appropriate.
- MUST implement a meaningful not-found experience.
- SHOULD use Suspense boundaries for asynchronous content when beneficial.

### 12.5 Navigation and Assets

- MUST use `next/image` where appropriate for images.
- MUST use `next/font` or an established font-loading strategy.
- SHOULD use Next.js built-in capabilities before introducing equivalent third-party solutions.

---

## 13. Environment Configuration and Security

### 13.1 Environment Variables

- MUST use environment variables for environment-specific configuration.
- MUST prefix variables with `NEXT_PUBLIC_` only when their values are intentionally exposed to the browser.
- MUST NOT expose API secrets, private keys, database credentials, or authentication secrets through public environment variables.
- SHOULD validate required environment variables at application startup or within the relevant server-side configuration module.

### 13.2 Authentication and Authorization

- MUST treat the backend as the authoritative authorization boundary.
- MUST NOT rely on hidden UI elements to protect resources.
- MUST handle unauthorized API responses consistently.
- MUST ensure authenticated data is isolated between users.
- MUST apply the application's defined CSRF and CORS protection strategy.

### 13.3 Input and Output Security

- MUST avoid rendering untrusted HTML.
- MUST NOT use `dangerouslySetInnerHTML` without a documented and safe sanitization strategy.
- MUST validate data received from external services.
- MUST NOT expose sensitive server-side information through client-side errors.

---

## 14. Testing Standards

### 14.1 Unit Testing

- SHOULD test utility functions, validation logic, and reusable business logic.
- MUST test critical data transformation and filtering logic.

### 14.2 Component Testing

- SHOULD test component rendering and user interactions.
- MUST test important form validation and submission behavior.
- SHOULD test loading, empty, and error states.

### 14.3 Integration Testing

- SHOULD test API integration and state synchronization.
- MUST test authentication-dependent behavior.
- MUST verify correct handling of API failures.

### 14.4 End-to-End Testing

- MUST test critical user workflows.
- SHOULD cover authentication, navigation, task creation, editing, and deletion.
- MUST verify that unauthorized users cannot access protected application functionality.

### 14.5 Testing Tools

- SHOULD use the project's established testing framework.
- MAY use Vitest or Jest for unit and component tests.
- MAY use React Testing Library for component behavior.
- SHOULD use Playwright for end-to-end testing.

- MUST NOT introduce additional testing frameworks without a clear need.

---

## 15. Dependency Management

- MUST inspect existing dependencies before installing new packages.
- MUST prefer existing project utilities and native platform capabilities.
- MUST justify dependencies that introduce significant bundle size or architectural complexity.
- MUST avoid installing multiple libraries that solve the same problem.
- MUST use compatible and maintained package versions.
- MUST NOT modify unrelated dependency versions during feature implementation without justification.

---

## 16. AI Coding Agent Instructions

AI coding agents MUST follow these instructions when modifying the frontend.

### 16.1 Before Implementation

1. Inspect the relevant project structure.
2. Read existing components and implementation patterns.
3. Identify related types, hooks, services, and API contracts.
4. Understand the existing authentication and data-fetching architecture.
5. Identify dependencies that can be reused.
6. Confirm assumptions when requirements are ambiguous and materially affect implementation.

### 16.2 During Implementation

1. Follow the established folder structure.
2. Reuse existing components and utilities.
3. Respect Server and Client Component boundaries.
4. Keep TypeScript types accurate.
5. Implement loading, error, empty, and success states where relevant.
6. Handle API failures and user input correctly.
7. Avoid unrelated changes.
8. Do not introduce unnecessary dependencies.
9. Do not silently remove existing functionality.
10. Do not implement mock data as a replacement for real API integration unless explicitly requested.

### 16.3 After Implementation

1. Run relevant linting checks.
2. Run TypeScript type checking.
3. Run relevant unit and component tests.
4. Run relevant end-to-end tests when available.
5. Verify the production build when the change warrants it.
6. Review the modified files for duplicated logic and architectural violations.
7. Report any unresolved issues or assumptions.

### 16.4 Completion Report

After implementation, provide:

- Summary of changes.
- Files created or modified.
- Important architectural decisions.
- Tests and validation performed.
- Known limitations or unresolved issues.

AI coding agents MUST NOT claim that tests or builds passed unless they were actually executed successfully.

---

## 17. Definition of Done

A frontend feature is considered complete when:

1. The implementation satisfies its functional requirements.
2. The implementation follows established architectural conventions.
3. Server and Client Component boundaries are appropriate.
4. TypeScript errors are resolved.
5. Validation and error handling are implemented.
6. Loading, empty, and success states are implemented where applicable.
7. Accessibility requirements are satisfied.
8. Responsive layouts are verified.
9. Relevant automated tests pass.
10. No unnecessary dependencies or unrelated changes are introduced.
11. No known critical security or data exposure issues remain.
12. The implementation is ready for review and integration.

---

## 18. Engineering Decision Priority

When requirements or implementation choices conflict, follow this priority:

1. Security and data integrity.
2. Functional correctness.
3. Existing project architecture and compatibility.
4. Accessibility.
5. Maintainability and readability.
6. Performance.
7. Developer convenience.
8. Code-style preferences.

Security, correctness, and compatibility MUST NOT be sacrificed to satisfy stylistic preferences.

When an exception to these standards is necessary, document the reason and keep the exception narrowly scoped.