import { useCallback, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { moveCard } from "@/lib/services/cardsService";
import { computeCardOrder } from "@/lib/cardOrder";
import type { Card } from "@/lib/types/api";

/** Column id -> cards of that column, sorted by `order`. */
export type ColumnCardMap = Record<string, Card[]>;

/**
 * Pure helper: remove `cardId` from its column and insert it into
 * `targetColumnId` before `beforeCardId` (or at the end when null),
 * giving it `column_id` and `order`.
 */
export function applyMove(
  columns: ColumnCardMap,
  cardId: string,
  targetColumnId: string,
  beforeCardId: string | null,
  order: number,
): ColumnCardMap {
  let moving: Card | undefined;
  const next: ColumnCardMap = {};
  for (const [colId, cards] of Object.entries(columns)) {
    const found = cards.find((c) => c.id === cardId);
    if (found) moving = found;
    next[colId] = cards.filter((c) => c.id !== cardId);
  }
  if (!moving || !next[targetColumnId]) return columns;

  const dest = next[targetColumnId];
  const index =
    beforeCardId === null ? dest.length : dest.findIndex((c) => c.id === beforeCardId);
  dest.splice(index < 0 ? dest.length : index, 0, {
    ...moving,
    column_id: targetColumnId,
    order,
  });
  return next;
}

export interface UseDragAndDropOptions {
  /** Current column state owned by the board component. */
  columns: ColumnCardMap;
  /** Receives the optimistic state, and the snapshot again on rollback. */
  onColumnsChange: (columns: ColumnCardMap) => void;
  /** Called after the server accepted the move (refetch to learn new orders). */
  onMoveSuccess?: () => void;
  /** Called after the state was rolled back because the move failed. */
  onMoveError?: (error: Error) => void;
}

export interface DragHandlers {
  onDragStart: (e: React.DragEvent<HTMLElement>, cardId: string) => void;
  onDragEnd: (e: React.DragEvent<HTMLElement>) => void;
  onDragOver: (e: React.DragEvent<HTMLElement>) => void;
  /**
   * `beforeCardId` is the card the dragged card was dropped on (insert before
   * it), or null when dropped on the empty part of the column (append).
   */
  onDrop: (
    e: React.DragEvent<HTMLElement>,
    targetColumnId: string,
    beforeCardId: string | null,
  ) => void;
}

export interface UseDragAndDropReturn {
  draggingCardId: string | null;
  dragHandlers: DragHandlers;
}

/**
 * HTML5 drag and drop for cards with an optimistic update.
 *
 * Flow: snapshot -> optimistic state -> PATCH /api/v1/cards/{id}/position with
 * exactly {column_id, order} -> on success call onMoveSuccess, on failure
 * restore the snapshot and call onMoveError.
 */
export function useDragAndDrop({
  columns,
  onColumnsChange,
  onMoveSuccess,
  onMoveError,
}: UseDragAndDropOptions): UseDragAndDropReturn {
  const { token } = useAuth();
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  // Some browsers/test drivers give no dataTransfer payload, so keep our own copy.
  const draggedRef = useRef<string | null>(null);

  const onDragStart = useCallback(
    (e: React.DragEvent<HTMLElement>, cardId: string) => {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", cardId);
      draggedRef.current = cardId;
      setDraggingCardId(cardId);
    },
    [],
  );

  const onDragEnd = useCallback(() => {
    draggedRef.current = null;
    setDraggingCardId(null);
  }, []);

  const onDragOver = useCallback((e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (
      e: React.DragEvent<HTMLElement>,
      targetColumnId: string,
      beforeCardId: string | null,
    ) => {
      e.preventDefault();
      e.stopPropagation();
      const cardId = e.dataTransfer.getData("text/plain") || draggedRef.current;
      draggedRef.current = null;
      setDraggingCardId(null);
      if (!cardId || cardId === beforeCardId) return;

      const destination = columns[targetColumnId];
      if (!destination) return;
      const without = destination.filter((c) => c.id !== cardId);
      const index =
        beforeCardId === null
          ? without.length
          : Math.max(0, without.findIndex((c) => c.id === beforeCardId));
      const order = computeCardOrder(without, index);

      const snapshot = columns;
      onColumnsChange(applyMove(columns, cardId, targetColumnId, beforeCardId, order));

      void (async () => {
        try {
          if (!token) throw new Error("You must be signed in to move cards.");
          await moveCard(token, cardId, { column_id: targetColumnId, order });
          onMoveSuccess?.();
        } catch (err: unknown) {
          onColumnsChange(snapshot);
          onMoveError?.(err instanceof Error ? err : new Error("Move failed."));
        }
      })();
    },
    [columns, onColumnsChange, onMoveSuccess, onMoveError, token],
  );

  return {
    draggingCardId,
    dragHandlers: { onDragStart, onDragEnd, onDragOver, onDrop },
  };
}
