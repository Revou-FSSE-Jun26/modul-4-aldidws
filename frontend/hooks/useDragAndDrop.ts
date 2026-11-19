import { useCallback, useReducer, useRef } from "react";

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

/** Minimal card shape required by the hook. */
export interface DraggableCard {
  id: string;
  column_id: string;
  position: number;
  [key: string]: unknown; // allow callers to carry extra fields through
}

/** Column map keyed by column id — mirrors the board component's data shape. */
export type ColumnCardMap = Record<string, DraggableCard[]>;

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

async function patchCardPosition(
  token: string,
  cardId: string,
  columnId: string,
  position: number,
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/v1/cards/${cardId}/position`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ column_id: columnId, position }),
    cache: "no-store",
  });

  if (!res.ok) {
    const json = (await res.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    throw new Error(
      json?.error?.message ??
        `Failed to move card (${res.status})`,
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers — pure functions, no side effects
// ---------------------------------------------------------------------------

/**
 * Move `cardId` from its current column to `targetColumnId` at `targetIndex`,
 * returning a new ColumnCardMap with renormalised 0-based positions in both
 * the source and destination columns.
 *
 * This runs before the API call (optimistic update) so the UI responds
 * immediately.
 */
function applyMove(
  columns: ColumnCardMap,
  cardId: string,
  targetColumnId: string,
  targetIndex: number,
): ColumnCardMap {
  // Find the source column and card.
  let sourceColumnId: string | null = null;
  let card: DraggableCard | null = null;

  for (const [colId, cards] of Object.entries(columns)) {
    const found = cards.find((c) => c.id === cardId);
    if (found) {
      sourceColumnId = colId;
      card = found;
      break;
    }
  }

  if (!card || !sourceColumnId) return columns; // card not found — no-op

  const next: ColumnCardMap = {};

  for (const [colId, cards] of Object.entries(columns)) {
    if (colId === sourceColumnId) {
      // Remove from source
      next[colId] = cards
        .filter((c) => c.id !== cardId)
        .map((c, i) => ({ ...c, position: i }));
    } else {
      next[colId] = [...cards];
    }
  }

  // Insert into destination at targetIndex
  const destCards = next[targetColumnId] ?? [];
  const updated: DraggableCard = { ...card, column_id: targetColumnId };
  destCards.splice(targetIndex, 0, updated);
  next[targetColumnId] = destCards.map((c, i) => ({ ...c, position: i }));

  return next;
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

interface DragState {
  columns: ColumnCardMap;
  /** The card id currently being dragged. */
  draggingCardId: string | null;
  /** True while the PATCH request is in flight. */
  isMoving: boolean;
}

type DragAction =
  | { type: "DRAG_START"; cardId: string }
  | { type: "DRAG_END" }
  | {
      type: "OPTIMISTIC_MOVE";
      cardId: string;
      targetColumnId: string;
      targetIndex: number;
    }
  | { type: "ROLLBACK"; previousColumns: ColumnCardMap }
  | { type: "MOVE_COMPLETE" }
  | { type: "SET_COLUMNS"; columns: ColumnCardMap };

function reducer(state: DragState, action: DragAction): DragState {
  switch (action.type) {
    case "SET_COLUMNS":
      return { ...state, columns: action.columns };

    case "DRAG_START":
      return { ...state, draggingCardId: action.cardId };

    case "DRAG_END":
      return { ...state, draggingCardId: null };

    case "OPTIMISTIC_MOVE": {
      const updated = applyMove(
        state.columns,
        action.cardId,
        action.targetColumnId,
        action.targetIndex,
      );
      return { ...state, columns: updated, isMoving: true };
    }

    case "ROLLBACK":
      return { ...state, columns: action.previousColumns, isMoving: false };

    case "MOVE_COMPLETE":
      return { ...state, isMoving: false };

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Hook public API
// ---------------------------------------------------------------------------

export interface UseDragAndDropOptions {
  /** Initial column → card map, e.g. from the board fetch. */
  initialColumns: ColumnCardMap;
  /** Access token from AuthContext. Required for PATCH calls. */
  token: string | null;
  /**
   * Optional callback invoked after every successful move.
   * The board component can use this to sync its own state or trigger a
   * refetch if it doesn't rely on the hook's state exclusively.
   */
  onMoveSuccess?: (columns: ColumnCardMap) => void;
  /**
   * Optional callback invoked when the PATCH call fails.
   * The hook already rolls back state; this gives the caller a chance to
   * show a toast or other UI feedback.
   */
  onMoveError?: (error: Error) => void;
}

export interface DragHandlers {
  /** Attach to the draggable card element. */
  onDragStart: (
    e: React.DragEvent<HTMLElement>,
    cardId: string,
  ) => void;
  /** Attach to the draggable card element. */
  onDragEnd: (e: React.DragEvent<HTMLElement>) => void;
  /**
   * Attach to the column drop zone.
   * `targetIndex` is the visual position within the column where the card
   * should land.  Pass `column.cards.length` to append at the end.
   */
  onDrop: (
    e: React.DragEvent<HTMLElement>,
    targetColumnId: string,
    targetIndex: number,
  ) => void;
  /** Attach to the column drop zone to allow drops. */
  onDragOver: (e: React.DragEvent<HTMLElement>) => void;
}

export interface UseDragAndDropReturn {
  /** Current column state — rendered by the board component. */
  columns: ColumnCardMap;
  /** True while a card is being dragged (use for visual drag-over styling). */
  isDragging: boolean;
  /** True while the PATCH request is in flight. */
  isMoving: boolean;
  /** Drag event handlers to spread onto card and column elements. */
  dragHandlers: DragHandlers;
  /**
   * Sync the hook's internal column state from an external source.
   * Call this after the parent refetches data from the server.
   */
  syncColumns: (columns: ColumnCardMap) => void;
}

/**
 * Encapsulates HTML5 Drag and Drop state and the optimistic
 * PATCH /api/v1/cards/<id>/position mutation.
 *
 * Usage in a board component:
 * ```tsx
 * const { columns, dragHandlers } = useDragAndDrop({ initialColumns, token });
 *
 * // On a draggable card:
 * <div
 *   draggable
 *   onDragStart={(e) => dragHandlers.onDragStart(e, card.id)}
 *   onDragEnd={dragHandlers.onDragEnd}
 * />
 *
 * // On a column drop zone:
 * <div
 *   onDragOver={dragHandlers.onDragOver}
 *   onDrop={(e) => dragHandlers.onDrop(e, column.id, targetIndex)}
 * />
 * ```
 *
 * Design decisions:
 * - Uses `useReducer` so the snapshot + rollback logic is explicit and
 *   testable in isolation.
 * - Snapshot is taken immediately before the optimistic update so rollback
 *   always restores the last confirmed server state.
 * - Native HTML5 DnD API — no external library dependency.
 * - `column_id` and `position` are carried via `DataTransfer` so drop
 *   handlers don't need a shared mutable ref.
 */
export function useDragAndDrop({
  initialColumns,
  token,
  onMoveSuccess,
  onMoveError,
}: UseDragAndDropOptions): UseDragAndDropReturn {
  const [state, dispatch] = useReducer(reducer, {
    columns: initialColumns,
    draggingCardId: null,
    isMoving: false,
  });

  // Keep a stable ref to the latest columns for use inside async callbacks
  // without stale-closure issues.
  const columnsRef = useRef<ColumnCardMap>(state.columns);
  columnsRef.current = state.columns;

  // ---- onDragStart ----
  const onDragStart = useCallback(
    (e: React.DragEvent<HTMLElement>, cardId: string) => {
      e.dataTransfer.effectAllowed = "move";
      // Carry the card id through the drag — avoids shared mutable state.
      e.dataTransfer.setData("text/plain", cardId);
      dispatch({ type: "DRAG_START", cardId });
    },
    [],
  );

  // ---- onDragEnd ----
  const onDragEnd = useCallback((e: React.DragEvent<HTMLElement>) => {
    e.dataTransfer.clearData();
    dispatch({ type: "DRAG_END" });
  }, []);

  // ---- onDragOver ----
  const onDragOver = useCallback((e: React.DragEvent<HTMLElement>) => {
    // Prevent browser's default "no drop" cursor.
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  // ---- onDrop ----
  const onDrop = useCallback(
    (
      e: React.DragEvent<HTMLElement>,
      targetColumnId: string,
      targetIndex: number,
    ) => {
      e.preventDefault();

      const cardId = e.dataTransfer.getData("text/plain");
      if (!cardId) return;

      // Snapshot the current state BEFORE the optimistic update so we can
      // roll back to a known-good state if the PATCH fails.
      const previousColumns = columnsRef.current;

      // 1. Optimistically update local state — UI responds immediately.
      dispatch({
        type: "OPTIMISTIC_MOVE",
        cardId,
        targetColumnId,
        targetIndex,
      });

      // 2. Fire the PATCH — no await here; we handle success/failure async.
      void (async () => {
        if (!token) {
          dispatch({ type: "ROLLBACK", previousColumns });
          onMoveError?.(new Error("Not authenticated."));
          return;
        }

        try {
          await patchCardPosition(token, cardId, targetColumnId, targetIndex);
          dispatch({ type: "MOVE_COMPLETE" });
          onMoveSuccess?.(columnsRef.current);
        } catch (err: unknown) {
          // 3. Roll back to the snapshot taken before the optimistic update.
          dispatch({ type: "ROLLBACK", previousColumns });
          onMoveError?.(
            err instanceof Error ? err : new Error("Move failed."),
          );
        }
      })();
    },
    [token, onMoveSuccess, onMoveError],
  );

  const syncColumns = useCallback((columns: ColumnCardMap) => {
    dispatch({ type: "SET_COLUMNS", columns });
  }, []);

  return {
    columns: state.columns,
    isDragging: state.draggingCardId !== null,
    isMoving: state.isMoving,
    dragHandlers: { onDragStart, onDragEnd, onDrop, onDragOver },
    syncColumns,
  };
}
