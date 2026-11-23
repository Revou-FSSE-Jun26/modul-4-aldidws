# Frontend Engineering Guidelines — RevoTask

Five rules that were enforced or violated during RevoTask development.

---

## Server Components by Default

### Rule
React Server Components MUST be used by default. `"use client"` MUST NOT be added unless the component requires client-side state, browser APIs, interactive event handlers, or client-side context consumption. Entire pages MUST NOT be converted to Client Components when only a small section requires interactivity.

### Rationale
Server Components render on the server, reducing the client JavaScript bundle and keeping server-only credentials out of the browser. Converting entire pages to Client Components forces all their children into the client bundle unnecessarily.

### RevoTask Example
```tsx
// WRONG — entire page made a Client Component just for a modal toggle
"use client";
export default function BoardsPage() {
  const [showModal, setShowModal] = useState(false);
  // ... full page fetching, rendering, etc.
}

// CORRECT — page stays a Server Component; interactive part is isolated
// app/(dashboard)/boards/page.tsx  — Server Component, no "use client"
export default async function BoardsPage() {
  const boards = await fetchBoards();
  return (
    <main>
      <BoardsGrid boards={boards} />   {/* Client Component for drag interactions */}
      <CreateBoardButton />            {/* Client Component for modal */}
    </main>
  );
}
```

---

## Shared BaseButton Primitive

### Rule
Interactive button elements that appear across multiple pages or features MUST use the shared `<BaseButton>` component from `components/shared/BaseButton.tsx`. Raw `<button>` elements with duplicated Tailwind class strings are prohibited when `BaseButton` already covers the required variant.

### Rationale
Duplicating long Tailwind class strings across login, register, and other pages creates visual drift and makes global style changes require edits in many files. The `BaseButton` component centralises all button variants in one place.

### RevoTask Example
```tsx
// WRONG — raw button with 7-line class string duplicated across login and register
<button
  type="submit"
  disabled={isSubmitting}
  className="mt-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium
             text-white hover:bg-blue-700 focus:outline-none
             focus-visible:ring-2 focus-visible:ring-blue-500
             disabled:cursor-not-allowed disabled:opacity-60"
>
  {isSubmitting ? "Signing in…" : "Sign in"}
</button>

// CORRECT — shared primitive used consistently
import { BaseButton } from "@/components/shared/BaseButton";

<BaseButton type="submit" variant="primary" disabled={isSubmitting}>
  {isSubmitting ? "Signing in…" : "Sign in"}
</BaseButton>
```

---

## Feature Folder Structure

### Rule
Every substantial business domain (auth, boards, cards, columns, comments, notifications) MUST own its components, hooks, services, and types under `features/<feature-name>/`. Feature-specific code MUST NOT be placed in `components/shared/` or `lib/`. Shared utilities MUST NOT depend on feature-specific modules.

### Rationale
Co-locating feature code reduces the risk of unintended cross-feature coupling and makes it easier to find, modify, and test domain-specific logic. Placing feature code in shared folders creates circular dependency risks and obscures ownership.

### RevoTask Example
```
frontend/
├── features/
│   ├── auth/
│   │   ├── components/   LoginForm.tsx, RegisterForm.tsx
│   │   ├── hooks/        useAuth.ts
│   │   ├── services/     authService.ts
│   │   └── types/        auth.types.ts
│   ├── boards/
│   │   ├── components/   BoardCard.tsx, BoardsGrid.tsx, CreateBoardModal.tsx
│   │   ├── hooks/        useBoards.ts
│   │   ├── services/     boardService.ts
│   │   └── types/        board.types.ts
│   └── cards/
│       ├── components/   CardItem.tsx, CardDetailModal.tsx
│       ├── hooks/        useCardSearch.ts, useDragAndDrop.ts
│       └── services/     cardService.ts
└── components/
    └── shared/           BaseButton.tsx, BaseModal.tsx, BaseInput.tsx
```

---

## Centralised API Service Modules

### Rule
All HTTP communication with the Flask backend MUST be placed in domain-specific service modules inside `features/<feature>/services/` or `lib/api/`. Components MUST NOT contain inline `fetch()` calls or raw HTTP logic. API base URL MUST come from an environment variable.

### Rationale
Centralising HTTP logic allows consistent error handling, authentication headers, and timeout behaviour. Scattering `fetch` calls throughout components makes it impossible to change the base URL or add request middleware without touching many files.

### RevoTask Example
```ts
// WRONG — fetch call embedded directly in a component
export function BoardCard({ boardId }: { boardId: string }) {
  useEffect(() => {
    fetch(`http://localhost:5000/api/boards/${boardId}`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(r => r.json()).then(setBoard);
  }, [boardId]);
}

// CORRECT — service module handles transport details
// features/boards/services/boardService.ts
const BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

export async function fetchBoard(boardId: string, token: string): Promise<Board> {
  const res = await fetch(`${BASE}/api/boards/${boardId}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) throw await normaliseApiError(res);
  const json = await res.json();
  return json.data as Board;
}
```

---

## No setState Calls in useEffect Render Phase

### Rule
`setState` MUST NOT be called synchronously at the top level of a `useEffect` body. Auth-error derivation and initial loading state MUST be expressed as derived state on the render path, not through extra `setState` calls inside effects.

### Rationale
Calling `setState` synchronously inside a `useEffect` body causes an unnecessary extra render cycle on every effect execution. Under React's concurrent rendering model this can produce visual flicker and is flagged as an error by `eslint-plugin-react-hooks`.

### RevoTask Example
```tsx
// WRONG — synchronous setState in useEffect causes extra render cycle
useEffect(() => {
  if (isAuthLoading) return;
  if (!token) {
    setState({ status: "error", message: "You must be signed in." }); // ← VIOLATION
    return;
  }
  setState({ status: "loading" }); // ← VIOLATION
  async function load() { ... }
  load().catch(err => setState({ status: "error", message: err.message }));
}, [token, isAuthLoading, boardId]);

// CORRECT — auth error on the render path, setState only inside async callback
useEffect(() => {
  if (isAuthLoading || !token) return;
  async function load() { ... }
  load().catch(err => setState({ status: "error", message: err.message }));
}, [token, isAuthLoading, boardId]);

// Render path: derived state, no extra setState
if (!isAuthLoading && !token) {
  return <div role="alert">You must be signed in to view this board.</div>;
}
```
