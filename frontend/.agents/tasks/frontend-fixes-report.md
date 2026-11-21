# Frontend Fixes Report

## Files Created

| File | Description |
|---|---|
| `lib/toast.ts` | Centralised toast helpers wrapping react-hot-toast (`showSuccess`, `showError`, `showInfo`) |
| `components/shared/BaseBadge.tsx` | Shared badge component with 5 variants: default, primary, success, warning, danger |
| `app/register/page.tsx` | Registration page (Client Component) with 4 controlled fields, client-side validation, POST /api/auth/register, redirect to /login on success |

## Files Modified

| File | Change |
|---|---|
| `hooks/useErrorHandler.ts` | Replaced `import toast from "react-hot-toast"` with `import { showError } from "@/lib/toast"` and replaced `toast.error(message)` with `showError(message)` |
| `app/login/page.tsx` | Added `import { BaseButton } from "@/components/shared/BaseButton"` and replaced raw `<button>` element with `<BaseButton type="submit" variant="primary" disabled={isSubmitting}>` |

## Packages Installed

- `dotenv` + `@types/dotenv` — `playwright.config.ts` imported `dotenv` but the package was not installed, causing a pre-existing TS2307 error that blocked `tsc --noEmit`.

## npx tsc --noEmit output

```
(no output — exit code 0)
```

Zero type errors after installing `dotenv`.

## npx eslint (our files only)

Command: `npx eslint lib/toast.ts hooks/useErrorHandler.ts components/shared/BaseBadge.tsx app/register/page.tsx app/login/page.tsx`

```
(no output — exit code 0)
```

All 5 created/modified files pass lint with zero errors or warnings.

## Full ESLint output (project-wide)

7 pre-existing errors in files NOT modified by this task:

| File | Error |
|---|---|
| `components/board/BoardDetailView.tsx:131` | `react-hooks/set-state-in-effect` |
| `components/board/BoardsGrid.tsx:71` | `react-hooks/set-state-in-effect` |
| `components/board/CardDetailModal.tsx:242` | `react-hooks/set-state-in-effect` |
| `components/board/CardDetailModal.tsx:274` | `react-hooks/set-state-in-effect` |
| `components/board/MyTasksList.tsx:160` | `react-hooks/set-state-in-effect` |
| `hooks/useCardSearch.ts:115` | `react-hooks/refs` (ref written during render) |
| `hooks/useDragAndDrop.ts:260` | `react-hooks/refs` (ref written during render) |

These errors are pre-existing and outside the scope of this task.

## Task 3 Findings — BaseBadge usage audit

**BoardCard.tsx**: The component accepts a `meta` prop of type `ReactNode` and renders it directly — it does not render inline status/priority badge `<span>` elements with Tailwind badge classes. No badge pattern to replace.

**MyTasksList.tsx**: The `TaskRow` component renders only `card.title` as text. No status/priority badge spans are rendered. No badge pattern to replace.

No changes were needed in either file for Task 3.

## Task 5b Findings — my-tasks and MyTasksList button audit

**`app/my-tasks/page.tsx`**: Server Component with no interactive `<button>` elements. No change needed.

**`components/board/MyTasksList.tsx`**: The empty-state CTA uses a styled `<Link>` element rather than `<BaseButton>`. This is intentional — nesting an `<a>` anchor inside a `<button>` is invalid HTML. The existing approach is correct and was not changed.

## Task 5c Findings — profile/page.tsx audit

`BaseButton` is already imported (`import { BaseButton } from "@/components/shared/BaseButton"`) and used in the form submit action (`<BaseButton type="submit" variant="primary" disabled={isSubmitting}>`). No changes needed.
